import type { Logger } from '../../domain/core/logger.js';
import type { TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { WorldRegion } from '../../domain/schemas/region-schema.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import type { MoodConfig } from '../../domain/systems/mood.js';
import { RegionSchema } from '../../domain/schemas/region-schema.js';
import { buildRegionGraph, type RegionGraph } from '../../domain/systems/pathfinding.js';
import { pointInPolygon } from '../../domain/core/polygon.js';
import { createAgentSpawner } from '../entity/agent-spawner.js';
import { createTraitLoader } from '../entity/trait-loader.js';
import { createLocationLoader } from '../entity/location-loader.js';
import { createMDSLLoader } from '../entity/bt-loader.js';
import { createItemLoader } from '../entity/item-loader.js';
import { validateWorldConsistency } from '../../domain/systems/world-validation.js';
import { FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { InventoryComponent } from '../components/inventory-component.js';
import type { Item } from '../../domain/schemas/item-schema.js';

export interface WorldData {
	agents: AgentActor[];
	traitDefs: Record<string, TraitDefinition>;
	locations: WorldLocation[];
	regions: WorldRegion[];
	regionGraph: RegionGraph;
	btMdslDefinitions: Record<string, string>;
	jobTrees: Record<string, string>;
	joblessMdsl: string;
	items: Map<string, Item>;
	errors: { step: string; file: string; message: string }[];
}

export type LoadProgress = (step: number, total: number, label: string) => void;

interface WorldLoaderConfig {
	moodConfig: MoodConfig;
	memoryMaxEntries: number;
	/** Vault-relative root path for game data (agents/, locations/, etc.) */
	dataRoot: string;
	/** Job definitions from game config — keys are job names */
	jobDefinitions?: Record<string, { primary_attribute: string }>;
}

function collectErrors(step: string, errors: { file: string; message: string }[], target: WorldData['errors']): void {
	for (const e of errors) target.push({ step, ...e });
}

function buildTraitMap(items: TraitDefinition[]): Record<string, TraitDefinition> {
	const map: Record<string, TraitDefinition> = {};
	for (const trait of items) map[trait.id] = trait;
	return map;
}

const STEPS = [
	'Loading traits...',
	'Loading agents...',
	'Loading locations...',
	'Loading regions...',
	'Loading behavior trees...',
	'Loading items...',
] as const;

async function loadRegions(
	vault: VaultReader,
	path: string,
): Promise<{ items: WorldRegion[]; errors: { file: string; message: string }[] }> {
	const items: WorldRegion[] = [];
	const errors: { file: string; message: string }[] = [];
	const files = await vault.list(path);
	for (const file of files) {
		try {
			const content = await vault.read(file);
			const parsed: unknown = JSON.parse(content);
			items.push(RegionSchema.parse(parsed));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push({ file, message });
		}
	}
	return { items, errors };
}

export function createWorldLoader(
	logger: Logger,
	config: WorldLoaderConfig,
): { load(vault: VaultReader, onProgress?: LoadProgress): Promise<WorldData> } {
	function validateLocationRegions(locations: WorldLocation[], regions: WorldRegion[]): void {
		for (const loc of locations) {
			if (loc.region !== null) {
				// Declared region — verify containment
				const region = regions.find(r => r.id === loc.region);
				if (region === undefined) {
					logger.warn('WorldLoader', `Location "${loc.id}" references unknown region "${loc.region}"`);
					continue;
				}
				const inside = pointInPolygon(loc.position.x, loc.position.y, { vertices: region.bounds });
				if (!inside) {
					logger.warn('WorldLoader', `Location "${loc.id}" at (${String(loc.position.x)}, ${String(loc.position.y)}) is outside its declared region "${loc.region}"`);
				}
			} else {
				// No region declared — auto-assign by containment
				const containing = regions.find(r =>
					pointInPolygon(loc.position.x, loc.position.y, { vertices: r.bounds }),
				);
				if (containing !== undefined) {
					loc.region = containing.id;
					logger.info('WorldLoader', `Auto-assigned location "${loc.id}" to region "${containing.id}"`);
				} else {
					logger.warn('WorldLoader', `Location "${loc.id}" at (${String(loc.position.x)}, ${String(loc.position.y)}) does not fall within any region`);
				}
			}
		}
	}

	return {
		async load(vault: VaultReader, onProgress?: LoadProgress): Promise<WorldData> {
			const total = STEPS.length;
			const errors: WorldData['errors'] = [];

			onProgress?.(1, total, STEPS[0]);
			const root = config.dataRoot;
			const traitResult = await createTraitLoader(logger).loadFromVault(vault, `${root}/traits`);
			collectErrors('traits', traitResult.errors, errors);

			onProgress?.(2, total, STEPS[1]);
			const spawnResult = await createAgentSpawner(logger, config.moodConfig, config.memoryMaxEntries)
				.spawnFromVault(vault, `${root}/agents`);
			collectErrors('agents', spawnResult.errors, errors);

			onProgress?.(3, total, STEPS[2]);
			const locationResult = await createLocationLoader(logger).loadFromVault(vault, `${root}/locations`);
			collectErrors('locations', locationResult.errors, errors);

			onProgress?.(4, total, STEPS[3]);
			const regionResult = await loadRegions(vault, `${root}/regions`);
			collectErrors('regions', regionResult.errors, errors);
			const regionGraph = buildRegionGraph(regionResult.items);

			// Validate location-region containment
			validateLocationRegions(locationResult.items, regionResult.items);

			onProgress?.(5, total, STEPS[4]);
			const btPath = `${root}/behavior-trees`;
			const jobsPath = `${root}/jobs`;
			const mdslLoader = createMDSLLoader(logger);
			const btMdslDefinitions: Record<string, string> = {};
			const jobTrees: Record<string, string> = {};

			// Load base BT
			let baseMdsl = '';
			try {
				baseMdsl = await vault.read(`${btPath}/base.mdsl`);
			} catch {
				logger.error('WorldLoader', 'Failed to read base.mdsl');
				errors.push({ step: 'behavior-trees', file: `${btPath}/base.mdsl`, message: 'File not found' });
			}

			// Compose job trees from config definitions
			const jobNames = Object.keys(config.jobDefinitions ?? {});
			if (baseMdsl !== '') {
				for (const jobName of jobNames) {
					const result = await mdslLoader.loadComposed(
						vault,
						`${btPath}/base.mdsl`,
						`${jobsPath}/${jobName}.mdsl`,
					);
					collectErrors('jobs', result.errors, errors);
					if (result.mdsl !== null) {
						jobTrees[jobName] = result.mdsl;
						btMdslDefinitions[jobName] = result.mdsl; // backward compat
					}
				}
			}

			// Build jobless MDSL variant — replace branch [Job] with action [Wander]
			const joblessMdsl = baseMdsl.replace(
				/branch\s*\[Job\]/,
				'action [Wander]',
			);

			onProgress?.(6, total, STEPS[5]);
			const itemResult = await createItemLoader(logger).loadFromVault(vault, `${root}/items`);
			collectErrors('items', itemResult.errors, errors);
			const itemRegistry = new Map<string, Item>();
			for (const item of itemResult.items) {
				itemRegistry.set(item.id, item);
			}

			if (errors.length > 0) {
				logger.warn('WorldLoader', `${String(errors.length)} error(s) during world load`);
			}
			logger.info('WorldLoader', `World loaded: ${String(traitResult.items.length)} traits, ${String(spawnResult.agents.length)} agents, ${String(locationResult.items.length)} locations, ${String(regionResult.items.length)} regions, ${String(Object.keys(btMdslDefinitions).length)} BTs, ${String(itemRegistry.size)} items`);

			// Startup consistency validation
			const validationWarnings = validateWorldConsistency({
				agents: spawnResult.agents.map(a => ({
					id: a.agentId,
					name: a.agentName,
					job: a.job,
					inventory: a.get(InventoryComponent).state.items,
					behaviorTree: a.job ?? '',
				})),
				locations: locationResult.items.map(loc => ({
					id: loc.id,
					type: loc.type,
					facility_type: loc.facility_type ?? loc.type,
					production: loc.production !== null
						? {
							job: loc.production.job,
							output: { item_id: loc.production.output.item_id },
							input: loc.production.input !== null ? { item_id: loc.production.input.item_id } : null,
						}
						: null,
				})),
				btDefinitions: btMdslDefinitions,
				knownFoodItems: FOOD_ITEMS,
				knownActions: new Set<string>(),
			});
			for (const warning of validationWarnings) {
				logger.warn('WorldValidation', warning.message);
			}

			return {
				agents: spawnResult.agents,
				traitDefs: buildTraitMap(traitResult.items),
				locations: locationResult.items,
				regions: regionResult.items,
				regionGraph,
				btMdslDefinitions,
				jobTrees,
				joblessMdsl,
				items: itemRegistry,
				errors,
			};
		},
	};
}
