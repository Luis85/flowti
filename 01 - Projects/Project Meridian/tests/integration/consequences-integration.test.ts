import { describe, it, expect } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { AgentActor } from '../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../src/infrastructure/components/needs-component.js';
import { BlackboardComponent } from '../../src/infrastructure/components/blackboard-component.js';
import { MemoryComponent } from '../../src/infrastructure/components/memory-component.js';
import { PerceptionComponent } from '../../src/infrastructure/components/perception-component.js';
import { TimeComponent } from '../../src/infrastructure/components/time-component.js';
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
import { Actor } from 'excalibur';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../src/domain/core/events.js';
import type { WorldLocation } from '../../src/domain/schemas/location-schema.js';
import type { BTNode } from '../../src/domain/schemas/behavior-tree-schema.js';
import type { Agent } from '../../src/domain/schemas/agent-schema.js';

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

function createTestAgent(id: string, x: number, y: number, overrides: Record<string, unknown> = {}): Agent {
	return {
		id, name: id, kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: 0, memory: [], goals: [], skills: [], inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [], wallet: { gold: 50 }, xp: 0, level: 1,
		position: { x, y, region: 'test' }, relationships: '',
		color: '#b0b0b0', persona: null, property: [],
		tools: [], behavior_tree: 'bt-merchant', job: null,
		...overrides,
	} as Agent;
}

const btDefs: Record<string, BTNode> = {
	merchant: { type: 'action', action: 'idle', params: {} },
};

function createWorldEntity(): Actor {
	const world = new Actor();
	world.addComponent(new TimeComponent({ phase: 'day', tickInCycle: 60, dayCount: 0 }));
	return world;
}

function createDeps(eventBus: ReturnType<typeof createEventBus>): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 60,
	};
}

describe('Consequence Systems — Integration', () => {
	it('hungry agent at food location recovers hunger after tick', () => {
		const eventBus = createEventBus();

		const agentData = createTestAgent('agent-hungry', 100, 100, { needs: { hunger: 50, energy: 80, social: 80 } });
		const actor = new AgentActor(agentData, defaultMoodConfig);
		actor.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Set btAction to 'eat' — FeedSystem requires this for recovery
		const bb = actor.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'eat' };

		const foodLocation: WorldLocation = {
			id: 'loc-tavern-food', name: 'Tavern Kitchen', type: 'food',
			position: { x: 100, y: 100, region: 'test' }, capacity: 10, color: '#808080',
		};

		const worldEntity = createWorldEntity();
		const actors = [actor];
		const locations = [foodLocation];
		const getAgents = () => actors;
		const getLocations = () => locations;
		const getWorld = () => worldEntity;

		// Omit BehaviorTreeSystem so it does not overwrite btAction
		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createDayNightSystem(getWorld));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createMemoryDecaySystem(getAgents));
		runner.register(createMovementSystem(getAgents, getLocations));
		runner.register(createRestSystem(getAgents, getLocations));
		runner.register(createFeedSystem(getAgents, getLocations));
		runner.register(createSocializeSystem(getAgents));

		const deps = createDeps(eventBus);
		runner.tick(deps);
		const hungerAfter = actor.get(NeedsComponent).state.hunger;

		// Feed recovery (0.3) minus hunger decay (0.5) = net -0.2, but recovery still applied
		// hungerBefore=50, decay=0.5 → without feed: 49.5, with feed: 49.8
		expect(hungerAfter).toBeCloseTo(49.8);
	});

	it('agent rests at tavern — energy recovers, RestStarted emitted', () => {
		const eventBus = createEventBus();

		const agentData = createTestAgent('agent-tired', 200, 200, { needs: { hunger: 80, energy: 50, social: 80 } });
		const actor = new AgentActor(agentData, defaultMoodConfig);
		actor.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Set btAction to 'idle' so RestSystem triggers outdoors tier at minimum
		const bb = actor.get(BlackboardComponent);
		bb.state = { ...bb.state, btAction: 'idle' };

		const restLocation: WorldLocation = {
			id: 'loc-inn-rest', name: 'Village Inn', type: 'rest',
			position: { x: 200, y: 200, region: 'test' }, capacity: 10, color: '#808080',
		};

		const worldEntity = createWorldEntity();
		const actors = [actor];
		const locations = [restLocation];
		const getAgents = () => actors;
		const getLocations = () => locations;
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
		runner.register(createRestSystem(getAgents, getLocations));
		runner.register(createFeedSystem(getAgents, getLocations));
		runner.register(createSocializeSystem(getAgents));

		const restEvents: GameEvent[] = [];
		eventBus.on('RestStarted', (e) => { restEvents.push(e); });

		const energyBefore = actor.get(NeedsComponent).state.energy;
		const deps = createDeps(eventBus);
		runner.tick(deps);
		const energyAfter = actor.get(NeedsComponent).state.energy;

		// Rest recovery (public_shelter 1.5) should exceed energy decay (0.25), so net energy increases
		expect(energyAfter).toBeGreaterThan(energyBefore);

		// RestStarted event should have been emitted for this agent
		expect(restEvents.length).toBeGreaterThanOrEqual(1);
		expect(restEvents[0]?.payload.agentId).toBe('agent-tired');
	});

	it('two agents socialize — both gain memory', () => {
		const eventBus = createEventBus();

		// Place two agents near each other (within interaction radius 25)
		const agent1Data = createTestAgent('agent-social-a', 100, 100, { needs: { hunger: 80, energy: 80, social: 30 } });
		const agent2Data = createTestAgent('agent-social-b', 110, 100, { needs: { hunger: 80, energy: 80, social: 30 } });

		const actor1 = new AgentActor(agent1Data, defaultMoodConfig);
		const actor2 = new AgentActor(agent2Data, defaultMoodConfig);
		actor1.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));
		actor2.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Set btAction to 'talk' on first agent so SocializeSystem triggers
		const bb1 = actor1.get(BlackboardComponent);
		bb1.state = { ...bb1.state, btAction: 'talk' };

		const worldEntity = createWorldEntity();
		const actors = [actor1, actor2];
		const locations: WorldLocation[] = [];
		const getAgents = () => actors;
		const getLocations = () => locations;
		const getWorld = () => worldEntity;

		// Register all systems EXCEPT BehaviorTreeSystem to prevent it from overwriting btAction
		const runner = createTickRunner(eventBus);
		runner.register(createTraitResolverSystem(getAgents, {}));
		runner.register(createDayNightSystem(getWorld));
		runner.register(createNeedsDecaySystem(getAgents));
		runner.register(createMoodSystem(getAgents));
		runner.register(createPerceptionSystem(getAgents, getLocations, getWorld));
		runner.register(createMemoryDecaySystem(getAgents));
		runner.register(createMovementSystem(getAgents, getLocations));
		runner.register(createRestSystem(getAgents, getLocations));
		runner.register(createFeedSystem(getAgents, getLocations));
		runner.register(createSocializeSystem(getAgents));

		const deps = createDeps(eventBus);
		runner.tick(deps);

		// Both agents should have gained at least 1 memory entry from socializing
		const mem1 = actor1.get(MemoryComponent).state.entries;
		const mem2 = actor2.get(MemoryComponent).state.entries;
		expect(mem1.length).toBeGreaterThanOrEqual(1);
		expect(mem2.length).toBeGreaterThanOrEqual(1);
	});
});
