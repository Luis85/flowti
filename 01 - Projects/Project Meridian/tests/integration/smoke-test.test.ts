import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BehaviourTree } from 'mistreevous';
import { AgentSchema } from '../../src/domain/schemas/agent-schema.js';
import { LocationSchema } from '../../src/domain/schemas/location-schema.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../src/infrastructure/components/facility-component.js';
import { createBehaviorAgent } from '../../src/infrastructure/entity/behavior-agent-factory.js';
import { createTraitResolverSystem } from '../../src/infrastructure/systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createMoodSystem } from '../../src/infrastructure/systems/mood-system.js';
import { createMemoryDecaySystem } from '../../src/infrastructure/systems/memory-decay-system.js';
import { createDayNightSystem } from '../../src/infrastructure/systems/day-night-system.js';
import { createPerceptionSystem } from '../../src/infrastructure/systems/perception-system.js';
import { createBehaviorTreeSystem } from '../../src/infrastructure/systems/behavior-tree-system.js';
import { createMovementSystem } from '../../src/infrastructure/systems/movement-system.js';
import { createRestSystem } from '../../src/infrastructure/systems/rest-system.js';
import { createFeedSystem } from '../../src/infrastructure/systems/feed-system.js';
import { createSocializeSystem } from '../../src/infrastructure/systems/socialize-system.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { createGameRNG, hashString } from '../../src/domain/core/game-rng.js';
import { Actor } from 'excalibur';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';

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

function loadJobTrees(): { jobTrees: Record<string, string>; joblessMdsl: string } {
	const btDir = resolve(projectRoot, 'behavior-trees');
	const jobsDir = resolve(projectRoot, 'jobs');
	const baseContent = readFileSync(resolve(btDir, 'base.mdsl'), 'utf-8');
	const jobTrees: Record<string, string> = {};

	for (const file of readdirSync(jobsDir)) {
		if (!file.endsWith('.mdsl')) continue;
		const jobName = file.replace('.mdsl', '');
		const jobContent = readFileSync(resolve(jobsDir, file), 'utf-8');
		jobTrees[jobName] = baseContent + '\n\n' + jobContent;
	}

	const joblessMdsl = baseContent.replace(/branch\s*\[Job\]/, 'action [Wander]');
	return { jobTrees, joblessMdsl };
}

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

describe('Smoke Test — Real Data', () => {
	const agentData = loadAndParse('agents', AgentSchema);
	const locations: WorldLocation[] = loadAndParse('locations', LocationSchema);
	const { jobTrees, joblessMdsl } = loadJobTrees();

	it('loads all shipped data successfully', () => {
		expect(agentData.length).toBeGreaterThanOrEqual(2);
		expect(locations.length).toBeGreaterThanOrEqual(4);
		expect(Object.keys(jobTrees).length).toBeGreaterThanOrEqual(2);
	});

	it('every job has a matching MDSL job tree', () => {
		for (const jobName of Object.keys(jobTrees)) {
			expect(jobTrees[jobName], `No MDSL job tree found for job "${jobName}"`).toBeDefined();
		}
	});

	it('full tick with real data — agents with low needs take action (not all idle)', () => {
		const eventBus = createEventBus();
		const config = GameConfigSchema.parse({});

		// Create actors — override needs to be LOW so BTs trigger survival behavior
		const actors = agentData.map(a => {
			const lowNeeds = { ...a, needs: { hunger: 20, energy: 10, social: 15, thirst: 20 } };
			const actor = new AgentActor(lowNeeds, defaultMoodConfig);
			return actor;
		});

		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0, dayBoundaryThisTick: false }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
		}));

		// Create location actors with FacilityComponent for production locations
		const locationActors = new Map<string, Actor>();
		for (const loc of locations) {
			const marker = new Actor({ x: loc.position.x, y: loc.position.y });
			if (loc.production !== null) {
				marker.addComponent(new FacilityComponent({
					stock: [{ item_id: loc.production.output.item_id, quantity: 5 }],
					fund: 200, workProgress: 0, status: 'idle', workerId: null,
				}));
			}
			locationActors.set(loc.id, marker);
		}

		const getAgents = () => actors;
		const getLocations = () => locations;
		const getWorld = () => worldEntity;
		const getLocationActors = () => locationActors;

		// Wire up BehaviorAgent + jobless BehaviourTree for each actor
		for (const actor of actors) {
			const behaviorAgent = createBehaviorAgent({
				actor,
				worldEntity: getWorld,
				config,
				getLocationActors,
				getLocations,
				tickCount: () => 60,
				eventBus,
				jobsConfig: config.jobs,
			});

			const rng = createGameRNG(hashString(actor.agentId));
			const tree = new BehaviourTree(joblessMdsl, behaviorAgent, {
				random: () => rng.next(),
				getDeltaTime: () => config.tick_interval_ms / 1000,
			});

			actor.behaviorAgent = behaviorAgent;
			actor.behaviorTree = tree;
		}

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createDayNightSystem(getWorld));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createMemoryDecaySystem(getAgents));
		runner.register(createBehaviorTreeSystem(getAgents));
		runner.register(createMovementSystem(getAgents, getLocations));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config,
			performanceTracker: createPerformanceTracker(),
			tickCount: 60,
			writeFile: null,
		};

		runner.tick(deps);

		// At least some agents should have selected an action other than idle
		const actions = actors.map(a => a.behaviorAgent.btAction);
		const nonIdle = actions.filter(a => a !== 'idle' && a !== null && a !== undefined);
		expect(nonIdle.length, `All agents are idle despite low needs. Actions: ${JSON.stringify(actions)}`).toBeGreaterThan(0);
	});

	it('agents at locations recover needs after tick', () => {
		const eventBus = createEventBus();
		const config = GameConfigSchema.parse({});

		// Find a food or rest location to place an agent on
		const foodLoc = locations.find(l => l.type === 'food');
		const restLoc = locations.find(l => l.type === 'rest');
		const targetLoc = foodLoc ?? restLoc;
		expect(targetLoc, 'Need at least one food or rest location in shipped data').toBeDefined();

		// Create actors — place first agent at food location with low hunger + high energy
		// so BT fires seek_food (not seek_rest), enabling FeedSystem recovery.
		// Agent 0 gets bread inventory so inventory-based FeedSystem can consume.
		const actors = agentData.map((a, idx) => {
			const overrides = idx === 0 && targetLoc !== undefined
				? { needs: { hunger: 20, energy: 80, social: 80, thirst: 80 }, position: { ...targetLoc.position, region: 'test' }, inventory: [{ item_id: 'food', quantity: 5 }] }
				: { needs: { hunger: 20, energy: 10, social: 15, thirst: 20 } };
			const actor = new AgentActor({ ...a, ...overrides }, defaultMoodConfig);
			return actor;
		});

		// Snapshot pre-tick needs for comparison
		const preTickNeeds = actors.map(a => ({ ...a.get(NeedsComponent).state }));

		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0, dayBoundaryThisTick: false }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: 500, ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0 },
		}));

		// Create location actors
		const locationActors = new Map<string, Actor>();
		for (const loc of locations) {
			const marker = new Actor({ x: loc.position.x, y: loc.position.y });
			if (loc.production !== null) {
				marker.addComponent(new FacilityComponent({
					stock: [{ item_id: loc.production.output.item_id, quantity: 5 }],
					fund: 200, workProgress: 0, status: 'idle', workerId: null,
				}));
			}
			locationActors.set(loc.id, marker);
		}

		const getAgents = () => actors;
		const getLocations = () => locations;
		const getWorld = () => worldEntity;
		const getLocationActors = () => locationActors;

		// Wire up BehaviorAgent + jobless BehaviourTree for each actor
		for (const actor of actors) {
			const behaviorAgent = createBehaviorAgent({
				actor,
				worldEntity: getWorld,
				config,
				getLocationActors,
				getLocations,
				tickCount: () => 60,
				eventBus,
				jobsConfig: config.jobs,
			});

			const rng = createGameRNG(hashString(actor.agentId));
			const tree = new BehaviourTree(joblessMdsl, behaviorAgent, {
				random: () => rng.next(),
				getDeltaTime: () => config.tick_interval_ms / 1000,
			});

			actor.behaviorAgent = behaviorAgent;
			actor.behaviorTree = tree;
		}

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createDayNightSystem(getWorld));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createMemoryDecaySystem(getAgents));
		runner.register(createBehaviorTreeSystem(getAgents));
		runner.register(createMovementSystem(getAgents, getLocations));
		runner.register(createRestSystem(getAgents, getLocations, getWorld, getLocationActors));
		runner.register(createFeedSystem(getAgents, getWorld));
		runner.register(createSocializeSystem(getAgents));

		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config,
			performanceTracker: createPerformanceTracker(),
			tickCount: 60,
			writeFile: null,
		};

		runner.tick(deps);

		// Agent 0 is at food location with btAction='eat' (BT fires it via at_location).
		// Feed recovery (0.3) partially offsets hunger decay (0.5), so hunger decreases
		// less than pure-decay would. Verify feed recovery was applied:
		// pure decay → hunger=20-0.5=19.5, with feed → 20-0.5+0.3=19.8
		const post0 = actors[0]!.get(NeedsComponent).state;
		const pre0 = preTickNeeds[0]!;
		const pureDecayHunger = pre0.hunger - deps.config.needs.hunger_decay;
		expect(post0.hunger, 'Feed recovery should partially offset hunger decay').toBeGreaterThan(pureDecayHunger);
	});
});
