import { describe, it, expect } from 'vitest';
import { createMovementSystem } from '../../../src/infrastructure/systems/movement-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: id,
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 10, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 10 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 0,
		memory: [],
		goals: [],
		skills: [],
		inventory: [],
		equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
		traits: [],
		wallet: { gold: 50 },
		xp: 0,
		level: 1,
		position: { x, y, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0',
		persona: null,
		behavior_tree: 'bt/merchant.md',
		job: null,
		property: [],
		...overrides,
	};
}

function createTestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'food', position: { x, y, region: 'test' }, capacity: 10, color: '#808080' };
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('MovementSystem', () => {
	it('sets velocity toward target location', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);

		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Velocity should point toward target (positive x, zero y)
		expect(agent.vel.x).toBeGreaterThan(0);
		expect(agent.vel.y).toBeCloseTo(0);
		// DX=10, divisor=4, interval=500ms → speedPerTick=2.5, speedPerSec=5.0
		expect(agent.vel.x).toBeCloseTo(5.0, 2);
		expect(agent.vel.y).toBeCloseTo(0, 2);
	});

	it('emits AgentArrived and clears movementTarget on arrival', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		// Place agent very close to target — within one step
		// DX=10, basic_speed_divisor=4 → speed=2.5 per tick
		// Place target at distance 1 (well within step size of 2.5)
		const agent = new AgentActor(createTestAgentData('agent-2', 0, 0), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// Should have arrived
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-2');
		expect(events[0]?.payload.targetId).toBe('loc-food-1');
		expect(events[0]?.payload.targetType).toBe('location');

		// movementTarget should be cleared
		expect(agent.get(BlackboardComponent).state.movementTarget).toBeUndefined();

		// Agent should be snapped to the target position
		expect(agent.pos.x).toBeCloseTo(1, 1);
		expect(agent.pos.y).toBeCloseTo(0, 1);
	});

	it('zeroes velocity when no movementTarget', () => {
		const agent = new AgentActor(createTestAgentData('agent-3', 50, 50), defaultMoodConfig);

		const system = createMovementSystem(() => [agent], () => []);

		expect(() => { system.execute(createDeps()); }).not.toThrow();
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
		expect(agent.pos.x).toBeCloseTo(50);
		expect(agent.pos.y).toBeCloseTo(50);
	});

	it('sets velocity toward another agent target', () => {
		const agent1 = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-2', 200, 0), defaultMoodConfig);

		const bb = agent1.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'agent-2', type: 'agent' } };

		const system = createMovementSystem(() => [agent1, agent2], () => []);

		system.execute(createDeps());

		// Velocity should point toward agent2 (positive x)
		expect(agent1.vel.x).toBeGreaterThan(0);
		expect(agent1.vel.y).toBeCloseTo(0);
	});

	it('higher DX produces higher velocity', () => {
		const slowAgent = new AgentActor(createTestAgentData('slow', 0, 0, { attributes: { ST: 10, DX: 4, IQ: 10, HT: 10 } }), defaultMoodConfig);
		const fastAgent = new AgentActor(createTestAgentData('fast', 0, 0, { attributes: { ST: 10, DX: 20, IQ: 10, HT: 10 } }), defaultMoodConfig);

		const slowBb = slowAgent.get(BlackboardComponent);
		slowBb.state = { ...slowBb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const fastBb = fastAgent.get(BlackboardComponent);
		fastBb.state = { ...fastBb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 1000, 0)];
		const system = createMovementSystem(() => [slowAgent, fastAgent], () => locations);

		system.execute(createDeps());

		// Fast agent has higher velocity
		expect(fastAgent.vel.x).toBeGreaterThan(slowAgent.vel.x);
	});

	it('moving agent loses energy each tick', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0, { needs: { hunger: 80, energy: 90, social: 70 } }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		// DX=10, divisor=4 → speedPerTick=2.5, movement_energy_cost=0.1 → drain=0.25
		expect(needs.state.energy).toBe(90 - 0.25);
	});

	it('exhausted agent moves at half speed', () => {
		// energy < 15 (NEED_CRITICAL_THRESHOLDS.energy) → exhaustion_speed_modifier = 0.5
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0, { needs: { hunger: 80, energy: 10, social: 70 } }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Normal speed: DX=10, divisor=4, interval=500ms → 5.0 px/sec
		// Exhausted: 5.0 * 0.5 = 2.5 px/sec
		expect(agent.vel.x).toBeCloseTo(2.5, 2);
	});

	it('does not re-arrive when agent is already at target location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		const agent = new AgentActor(createTestAgentData('agent-1', 10, 0), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		// Agent is already at the target location
		bb.state = {
			...bb.state,
			atLocation: 'loc-food-1',
			movementTarget: { id: 'loc-food-1', type: 'location' },
		};

		const locations = [createTestLocation('loc-food-1', 10, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// movementTarget should be consumed silently
		expect(bb.state.movementTarget).toBeUndefined();
		// atLocation should be preserved
		expect(bb.state.atLocation).toBe('loc-food-1');
		// No arrival event — agent was already there
		expect(events.length).toBe(0);
		// Agent should not be moving
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
	});

	it('populates knownLocations on first arrival at a location', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		const knownLocations = bb.state.knownLocations as string[] | undefined;
		expect(knownLocations).toBeDefined();
		expect(knownLocations).toContain('loc-food-1');
	});

	it('does not duplicate knownLocations on repeat arrival', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, knownLocations: ['loc-food-1'], movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		const knownLocations = bb.state.knownLocations as string[];
		expect(knownLocations.filter(l => l === 'loc-food-1')).toHaveLength(1);
	});

	it('emits AgentExhausted when energy crosses 0', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentExhausted', (e) => { events.push(e); });

		// Start with very low energy that will cross 0
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0, { needs: { hunger: 80, energy: 0.1, social: 70 } }), defaultMoodConfig);
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(0);
	});
});
