import type { Logger } from '../../domain/core/logger.js';
import type { TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { BTNode } from '../../domain/systems/behavior-tree.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import type { MoodConfig } from '../../domain/systems/mood.js';
import { createAgentSpawner } from '../entity/agent-spawner.js';
import { createTraitLoader } from '../entity/trait-loader.js';
import { createLocationLoader } from '../entity/location-loader.js';
import { createBTLoader } from '../entity/bt-loader.js';

export interface WorldData {
	agents: AgentActor[];
	traitDefs: Record<string, TraitDefinition>;
	locations: WorldLocation[];
	btDefinitions: Record<string, BTNode>;
	errors: { step: string; file: string; message: string }[];
}

export type LoadProgress = (step: number, total: number, label: string) => void;

interface WorldLoaderConfig {
	moodConfig: MoodConfig;
	memoryMaxEntries: number;
}

function collectErrors(step: string, errors: { file: string; message: string }[], target: WorldData['errors']): void {
	for (const e of errors) target.push({ step, ...e });
}

function buildTraitMap(items: TraitDefinition[]): Record<string, TraitDefinition> {
	const map: Record<string, TraitDefinition> = {};
	for (const trait of items) map[trait.id] = trait;
	return map;
}

function buildBTMap(items: { id: string; root: BTNode }[]): Record<string, BTNode> {
	const map: Record<string, BTNode> = {};
	for (const bt of items) {
		const key = bt.id.startsWith('bt-') ? bt.id.slice(3) : bt.id;
		map[key] = bt.root;
	}
	return map;
}

const STEPS = [
	'Loading traits...',
	'Loading agents...',
	'Loading locations...',
	'Loading behavior trees...',
] as const;

export function createWorldLoader(
	logger: Logger,
	config: WorldLoaderConfig,
): { load(vault: VaultReader, onProgress?: LoadProgress): Promise<WorldData> } {
	return {
		async load(vault: VaultReader, onProgress?: LoadProgress): Promise<WorldData> {
			const total = STEPS.length;
			const errors: WorldData['errors'] = [];

			onProgress?.(1, total, STEPS[0]);
			const traitResult = await createTraitLoader(logger).loadFromVault(vault, '03 - Resources/Traits');
			collectErrors('traits', traitResult.errors, errors);

			onProgress?.(2, total, STEPS[1]);
			const spawnResult = await createAgentSpawner(logger, config.moodConfig, config.memoryMaxEntries)
				.spawnFromVault(vault, '03 - Resources/Agents');
			collectErrors('agents', spawnResult.errors, errors);

			onProgress?.(3, total, STEPS[2]);
			const locationResult = await createLocationLoader(logger).loadFromVault(vault, '03 - Resources/Locations');
			collectErrors('locations', locationResult.errors, errors);

			onProgress?.(4, total, STEPS[3]);
			const btResult = await createBTLoader(logger).loadFromVault(vault, '03 - Resources/BehaviorTrees');
			collectErrors('behavior-trees', btResult.errors, errors);

			if (errors.length > 0) {
				logger.warn('WorldLoader', `${String(errors.length)} error(s) during world load`);
			}
			logger.info('WorldLoader', `World loaded: ${String(traitResult.items.length)} traits, ${String(spawnResult.agents.length)} agents, ${String(locationResult.items.length)} locations, ${String(btResult.items.length)} BTs`);

			return {
				agents: spawnResult.agents,
				traitDefs: buildTraitMap(traitResult.items),
				locations: locationResult.items,
				btDefinitions: buildBTMap(btResult.items),
				errors,
			};
		},
	};
}
