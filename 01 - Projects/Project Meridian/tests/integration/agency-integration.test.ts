import { describe, it, expect } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { PerceptionComponent } from '../../src/infrastructure/components/perception-component.js';
import { BlackboardComponent } from '../../src/infrastructure/components/blackboard-component.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
import { createTraitResolverSystem } from '../../src/infrastructure/systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../../src/infrastructure/systems/needs-decay-system.js';
import { createMoodSystem } from '../../src/infrastructure/systems/mood-system.js';
import { createMemoryDecaySystem } from '../../src/infrastructure/systems/memory-decay-system.js';
import { createDayNightSystem } from '../../src/infrastructure/systems/day-night-system.js';
import { createPerceptionSystem } from '../../src/infrastructure/systems/perception-system.js';
import { createBehaviorTreeSystem } from '../../src/infrastructure/systems/behavior-tree-system.js';
import { createMovementSystem } from '../../src/infrastructure/systems/movement-system.js';
import { Actor } from 'excalibur';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../src/domain/core/events.js';
import type { BTNode } from '../../src/domain/systems/behavior-tree.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';

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

function createTestAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-test', name: 'Test', kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 30, energy: 90, social: 70 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x: 0, y: 0, region: 'test' }, relationships: '',
		tools: [], color: '#b0b0b0', behavior_tree: 'bt-merchant', job: null, property: [],
		...overrides,
	};
}

// Hunger-seek BT: if hunger < 50 AND food location nearby → seek_food, else idle
// seek_food is the action key that maps to 'food' location type in BT system LOCATION_ACTIONS
const hungerBT: BTNode = {
	type: 'selector',
	children: [
		{
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 50 } },
				{ type: 'condition', check: 'nearby_location', params: { locationType: 'food' } },
				{ type: 'action', action: 'seek_food', params: {} },
			],
		},
		{ type: 'action', action: 'idle', params: {} },
	],
};

const foodLocation: WorldLocation = {
	id: 'loc-food', name: 'Food Stall', type: 'food',
	position: { x: 100, y: 0 }, capacity: 10,
};

function createDeps(eventBus = createEventBus(), tickCount = 60): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
	};
}

describe('Agency Integration', () => {
	it('hungry agent perceives food location and moves toward it', () => {
		const eventBus = createEventBus();
		// hunger: 30 < 50 threshold, so BT will try to seek_food
		const agent = new AgentActor(createTestAgent({ needs: { hunger: 30, energy: 90, social: 70 } }), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// day phase: tickInCycle=60 falls in day range (60–299)
		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0 }));

		// btDefinitions keyed by agent.kind ('merchant')
		const btDefs: Record<string, BTNode> = { merchant: hungerBT };
		const getAgents = () => [agent];
		const getLocations = () => [foodLocation];
		const getWorld = () => worldEntity;

		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createDayNightSystem(getWorld));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createMemoryDecaySystem(getAgents));
		runner.register(createBehaviorTreeSystem(getAgents, btDefs, getWorld, 42));
		runner.register(createMovementSystem(getAgents, getLocations));

		// day perception radius = base_multiplier(20) * IQ(10) = 200 → food at x:100 is within range
		const deps = createDeps(eventBus, 60);
		runner.tick(deps);

		// Agent should have moved toward food location (x: 100)
		// speed = DX(10) / basic_speed_divisor(4) = 2.5 px/tick, starting at x:0
		expect(agent.pos.x).toBeGreaterThan(0);
		const bb = agent.get(BlackboardComponent);
		expect(bb.state.btAction).toBe('seek_food');
	});

	it('night reduces perception — agent misses far location', () => {
		const eventBus = createEventBus();
		// Place food outside night-reduced radius but within day radius.
		// With base_multiplier=2, IQ=10, night_multiplier=0.1:
		//   day radius   = 2 * 10       = 20
		//   night radius = 2 * 10 * 0.1 = 2
		// Food at x:10 is outside night radius (2) but inside day radius (20).
		const farFood: WorldLocation = {
			id: 'loc-far-food', name: 'Far Food', type: 'food',
			position: { x: 10, y: 0 }, capacity: 10,
		};

		const agent = new AgentActor(createTestAgent({ needs: { hunger: 30, energy: 90, social: 70 } }), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Pre-set night phase in the world entity — skip DayNightSystem so the phase stays 'night'.
		// (DayNightSystem derives phase from tickCount; tick 1 maps to dawn, not night.)
		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'night', tickInCycle: 400, dayCount: 0 }));

		const btDefs: Record<string, BTNode> = { merchant: hungerBT };
		const getAgents = () => [agent];
		const getLocations = () => [farFood];
		const getWorld = () => worldEntity;

		// Register perception + BT only — no DayNightSystem so phase stays 'night'
		const runner = createTickRunner(eventBus);
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createBehaviorTreeSystem(getAgents, btDefs, getWorld, 42));
		runner.register(createMovementSystem(getAgents, getLocations));

		// Use small base_multiplier so night radius = 2 < food distance (10)
		const deps: GameCoreDeps = {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus,
			config: GameConfigSchema.parse({ perception: { base_multiplier: 2, night_multiplier: 0.1 } }),
			performanceTracker: createPerformanceTracker(),
			tickCount: 1,
		};

		runner.tick(deps);

		// At night: radius = 2 * 10(IQ) * 0.1 = 2, food at x:10 → outside perception
		const perception = agent.get(PerceptionComponent);
		expect(perception.state.nearbyLocations).toHaveLength(0);

		// Agent should idle (no food perceived, BT falls through to idle action)
		const bb = agent.get(BlackboardComponent);
		expect(bb.state.btAction).toBe('idle');
	});

	it('agent arrives at location → AgentArrived emits', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		// Place agent very close to food — within one tick's movement
		// speed = DX(10) / 4 = 2.5 px/tick, agent at x:3, food at x:5, distance = 2 < 2.5 → arrives
		const nearFood: WorldLocation = {
			id: 'loc-near', name: 'Near Food', type: 'food',
			position: { x: 5, y: 0 }, capacity: 10,
		};

		const agent = new AgentActor(
			createTestAgent({
				needs: { hunger: 30, energy: 90, social: 70 },
				position: { x: 3, y: 0, region: 'test' },
			}),
			defaultMoodConfig,
		);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = new Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0 }));

		const btDefs: Record<string, BTNode> = { merchant: hungerBT };
		const getAgents = () => [agent];
		const getLocations = () => [nearFood];
		const getWorld = () => worldEntity;

		const runner = createTickRunner(eventBus);
		runner.register(createDayNightSystem(getWorld));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createBehaviorTreeSystem(getAgents, btDefs, getWorld, 42));
		runner.register(createMovementSystem(getAgents, getLocations));

		runner.tick(createDeps(eventBus, 60));

		// Agent should have arrived — MovementSystem fires AgentArrived when dist <= speed
		expect(events.length).toBeGreaterThan(0);
		expect(events[0]?.payload.agentId).toBe('agent-test');
		expect(events[0]?.payload.targetId).toBe('loc-near');
	});
});
