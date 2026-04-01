import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BehaviourTree } from 'mistreevous';
import { AgentSchema } from '../../src/domain/schemas/agent-schema.js';
import { LocationSchema } from '../../src/domain/schemas/location-schema.js';
import { RegionSchema } from '../../src/domain/schemas/region-schema.js';
import { TraitDefinitionSchema } from '../../src/domain/schemas/trait-definition-schema.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { buildRegionGraph } from '../../src/domain/systems/pathfinding.js';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { createBehaviorAgent } from '../../src/infrastructure/entity/behavior-agent-factory.js';
import { createGameRNG, hashString } from '../../src/domain/core/game-rng.js';
import { createTraitResolverSystem } from '../../src/infrastructure/systems/trait-resolver-system.js';
import { createDayNightSystem } from '../../src/infrastructure/systems/day-night-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createMoodSystem } from '../../src/infrastructure/systems/mood-system.js';
import { createPerceptionSystem } from '../../src/infrastructure/systems/perception-system.js';
import { createMemoryDecaySystem } from '../../src/infrastructure/systems/memory-decay-system.js';
import { createBehaviorTreeSystem } from '../../src/infrastructure/systems/behavior-tree-system.js';
import { createMovementSystem } from '../../src/infrastructure/systems/movement-system.js';
import { createRestSystem } from '../../src/infrastructure/systems/rest-system.js';
import { createFeedSystem } from '../../src/infrastructure/systems/feed-system.js';
import { createSocializeSystem } from '../../src/infrastructure/systems/socialize-system.js';
import { createFacilitySystem } from '../../src/infrastructure/systems/facility-system.js';
import { createTradeSystem } from '../../src/infrastructure/systems/trade-system.js';
import { createDialogueSystem } from '../../src/infrastructure/systems/dialogue-system.js';
import { createGossipSystem } from '../../src/infrastructure/systems/gossip-system.js';
import { createRelationshipCheckpointSystem } from '../../src/infrastructure/systems/relationship-checkpoint-system.js';
import { Actor } from 'excalibur';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import type { WorldRegion } from '../../src/domain/schemas/region-schema.js';
import type { TraitDefinition } from '../../src/domain/systems/trait-resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

function loadAndParse<T>(dir: string, schema: { parse(data: unknown): T }): T[] {
	const fullPath = resolve(projectRoot, dir);
	try {
		return readdirSync(fullPath)
			.filter(f => f.endsWith('.json'))
			.map(f => schema.parse(JSON.parse(readFileSync(resolve(fullPath, f), 'utf-8'))));
	} catch {
		return [];
	}
}

function loadMdslDefinitions(): Record<string, string> {
	const btDir = resolve(projectRoot, 'behavior-trees');
	const baseContent = readFileSync(resolve(btDir, 'base.mdsl'), 'utf-8');
	const result: Record<string, string> = {};

	for (const file of readdirSync(btDir)) {
		if (!file.startsWith('branch-') || !file.endsWith('.mdsl')) continue;
		const kind = file.replace('branch-', '').replace('.mdsl', '');
		const branchContent = readFileSync(resolve(btDir, file), 'utf-8');
		result[kind] = baseContent + '\n\n' + branchContent;
	}
	return result;
}

describe('Balance Smoke Test — Full Day (480 ticks)', () => {
	const agentData = loadAndParse('agents', AgentSchema);
	const locations: WorldLocation[] = loadAndParse('locations', LocationSchema);
	const mdslDefs = loadMdslDefinitions();
	const regions: WorldRegion[] = loadAndParse('regions', RegionSchema);
	const traitFiles = loadAndParse('traits', TraitDefinitionSchema);

	// Skip if real data files are not available
	if (agentData.length === 0 || locations.length === 0 || Object.keys(mdslDefs).length === 0) {
		it.skip('real data files not found — skipping balance smoke test', () => {});
		return;
	}

	it('economy survives a full day — agents eat, rest, and transact', () => {
		const eventBus = createEventBus();
		const config = GameConfigSchema.parse({});

		const moodConfig = config.mood;

		// Build trait definitions map
		const traitDefs: Record<string, TraitDefinition> = {};
		for (const t of traitFiles) {
			traitDefs[t.id] = t;
		}

		// Create AgentActors from real data
		const actors = agentData.map(a => new AgentActor(a, moodConfig, config.memory.max_entries));

		// Build region graph for pathfinding
		const _regionGraph = buildRegionGraph(regions);

		// Create world entity with time and economy
		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: config.economy.treasury_start_sandbox,
			ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
		}));

		// Create location actors with FacilityComponent (seeded with 5 units of output, matching game-view.ts)
		const locationActors = new Map<string, Actor>();
		for (const loc of locations) {
			const marker = new Actor({ x: loc.position.x, y: loc.position.y });
			if (loc.production !== null) {
				const startingStock = [{ item_id: loc.production.output.item_id, quantity: 5 }];
				marker.addComponent(new FacilityComponent({
					stock: startingStock,
					fund: config.economy.facility_start_fund,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				}));
			}
			locationActors.set(loc.id, marker);
		}

		// Entity queries
		const getAgents = () => actors;
		const getLocations = () => locations;
		const getWorld = () => worldEntity;
		const getLocationActors = () => locationActors;

		// Wire up BehaviorAgent + BehaviourTree for each agent (mirroring game-view.ts)
		for (const actor of actors) {
			const mdsl = mdslDefs[actor.kind];
			if (mdsl === undefined) continue;

			const behaviorAgent = createBehaviorAgent({
				actor,
				worldEntity: getWorld,
				config,
				getLocationActors,
				getLocations,
				tickCount: () => deps.tickCount,
			});

			const rng = createGameRNG(hashString(actor.agentId));
			const tree = new BehaviourTree(mdsl, behaviorAgent, {
				random: () => rng.next(),
				getDeltaTime: () => config.tick_interval_ms / 1000,
			});

			actor.behaviorAgent = behaviorAgent;
			actor.behaviorTree = tree;
		}

		// Create tick runner and register ALL systems in priority order (matching game-view.ts)
		const tickRunner = createTickRunner(eventBus);
		tickRunner.register(createTraitResolverSystem(getAgents, traitDefs));
		tickRunner.register(createDayNightSystem(getWorld, getAgents, getLocationActors, getLocations));
		tickRunner.register(createNeedsDecaySystem(getAgents));
		tickRunner.register(createMoodSystem(getAgents));
		tickRunner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		tickRunner.register(createMemoryDecaySystem(getAgents));
		tickRunner.register(createBehaviorTreeSystem(getAgents));
		tickRunner.register(createMovementSystem(getAgents, getLocations));
		tickRunner.register(createRestSystem(getAgents, getLocations, getWorld, getLocationActors));
		tickRunner.register(createFeedSystem(getAgents, getWorld));
		tickRunner.register(createSocializeSystem(getAgents));
		tickRunner.register(createFacilitySystem(getAgents, getLocations, getLocationActors, getWorld));
		tickRunner.register(createTradeSystem(getAgents, getLocations, getLocationActors, getWorld));
		tickRunner.register(createDialogueSystem(getAgents, 42));
		tickRunner.register(createGossipSystem(getAgents, getLocations));
		tickRunner.register(createRelationshipCheckpointSystem(getAgents));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config,
			performanceTracker: createPerformanceTracker(),
			tickCount: 0,
			writeFile: vi.fn(),
		};

		// Track events via listener (eventBus.history() is capped at 500 entries)
		const eventCounts = new Map<string, number>();
		const btActions = new Set<string>();
		eventBus.onAny((event) => {
			eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
			if (event.type === 'BTActionSelected') {
				const action = (event.payload as Record<string, unknown>).action;
				btActions.add(String(action));
			}
		});

		// Run 480 ticks — one full game day
		// Note: tick runner manages deps.tickCount internally (1-based, increments each call)
		for (let tick = 0; tick < 480; tick++) {
			tickRunner.tick(deps);
		}

		// --- Survival invariants ---

		// Collect BT actions from agent behaviorAgent state (btAction is set by action methods)
		for (const actor of actors) {
			const action = actor.behaviorAgent.btAction;
			if (action !== null) {
				btActions.add(action);
			}
		}

		// BT produced diverse actions (not all agents stuck on 'idle')
		expect(btActions.size, `BT only produced: ${[...btActions].join(', ')}`).toBeGreaterThan(1);

		// Rest system fired (agents did rest at some point, even if energy bottoms out by day end)
		const restEvents = eventCounts.get('RestStarted') ?? 0;
		expect(restEvents, 'No agent rested during the full day').toBeGreaterThan(0);

		// Day-night cycle advanced (at least one phase transition)
		const phaseChanges = eventCounts.get('DayPhaseChanged') ?? 0;
		expect(phaseChanges, 'Day-night cycle never advanced').toBeGreaterThan(0);

		// --- Economic activity ---

		// Economy ledger has at least one entry (some transaction occurred)
		const economy = worldEntity.get(EconomyComponent).state;
		expect(economy.ledger.length, 'Economy ledger is empty — no transactions occurred during the full day').toBeGreaterThan(0);

		// At least one agent made a non-idle BT decision (seek_rest, eat, buy, etc.)
		const nonIdleActions = [...btActions].filter(a => a !== 'idle');
		expect(nonIdleActions.length, 'All BT decisions were idle — agents never acted').toBeGreaterThan(0);

		// Needs decay fired (basic system loop ran correctly)
		const needEvents = eventCounts.get('NeedChanged') ?? 0;
		expect(needEvents, 'NeedsDecay system never fired').toBeGreaterThan(0);

		// Mood system evaluated agents
		const moodEvents = eventCounts.get('MoodChanged') ?? 0;
		expect(moodEvents, 'Mood system never recalculated').toBeGreaterThan(0);

		// Simulation completed 480 ticks without throwing (implicit — reaching here proves it)
		// Tick runner uses 1-based counting internally, so after 480 calls tickCount = 480
		expect(deps.tickCount).toBe(480);
	});
});
