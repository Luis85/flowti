import { describe, it, expect } from 'vitest';
import { createMovementSystem } from '../../../src/infrastructure/systems/movement-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

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

function createStubBehaviorAgent(overrides: Partial<BehaviorAgent> = {}): BehaviorAgent {
	return {
		hunger: 80, energy: 90, social: 70, gold: 50, mood: 0, moodBucket: 'stressed',
		timePhase: 'day', job: null, position: { x: 0, y: 0 }, inventory: [],
		nearbyAgents: [], nearbyLocations: [], nearbyFacilities: [],
		movementTarget: null, journey: null, atLocation: null, currentRegion: '',
		haulCargo: null, socialCooldowns: new Map(), committedAction: null,
		btAction: null, gossipPending: null, knownLocations: [], traitModifiers: null,
		skills: [], feedingAt: null, restingAt: null, arrivalSlot: null,
		IsHungry: () => false, IsExhausted: () => false, IsLonely: () => false,
		NeedsCritical: () => false, HasFood: () => false, HasGold: () => false,
		CanAffordFood: () => false, AtLocation: () => false, NearLocation: () => false,
		NearAgent: () => false, NearAgentClose: () => false, IsDaytime: () => true,
		IsNighttime: () => false, HasJob: () => false, AtJobFacility: () => false,
		FacilityHasStock: () => false, HasCargo: () => false, CargoDestinationNearby: () => false,
		FacilityNeedsSupply: () => false,
		Eat: () => 'mistreevous.failed', Rest: () => 'mistreevous.failed',
		SeekFood: () => 'mistreevous.failed', SeekRest: () => 'mistreevous.failed',
		SeekWork: () => 'mistreevous.failed', SeekSocial: () => 'mistreevous.failed',
		SeekMarket: () => 'mistreevous.failed', Work: () => 'mistreevous.failed',
		Talk: () => 'mistreevous.failed', Buy: () => 'mistreevous.failed',
		PickupCargo: () => 'mistreevous.failed', DeliverCargo: () => 'mistreevous.failed',
		SeekDeliveryTarget: () => 'mistreevous.failed', SeekSupplySource: () => 'mistreevous.failed',
		Idle: () => 'mistreevous.running', Wander: () => 'mistreevous.running',
		...overrides,
	};
}

function createAgentWithBa(id: string, x = 0, y = 0, overrides: Record<string, unknown> = {}, baOverrides: Partial<BehaviorAgent> = {}): AgentActor {
	const agent = new AgentActor(createTestAgentData(id, x, y, overrides), defaultMoodConfig);
	agent.behaviorAgent = createStubBehaviorAgent(baOverrides);
	return agent;
}

describe('MovementSystem', () => {
	it('sets velocity toward target location', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Velocity should point toward target (positive x, zero y)
		expect(agent.vel.x).toBeGreaterThan(0);
		expect(agent.vel.y).toBeCloseTo(0);
		// DX=10, divisor=4, interval=500ms -> speedPerTick=2.5, speedPerSec=5.0
		expect(agent.vel.x).toBeCloseTo(5.0, 2);
		expect(agent.vel.y).toBeCloseTo(0, 2);
	});

	it('emits AgentArrived and clears movementTarget on arrival', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		// Place agent very close to target — within one step
		const agent = createAgentWithBa('agent-2', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// Should have arrived
		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-2');
		expect(events[0]?.payload.targetId).toBe('loc-food-1');
		expect(events[0]?.payload.targetType).toBe('location');

		// movementTarget should be cleared
		expect(agent.behaviorAgent.movementTarget).toBeNull();

		// Agent should be snapped to the target position
		expect(agent.pos.x).toBeCloseTo(1, 1);
		expect(agent.pos.y).toBeCloseTo(0, 1);
	});

	it('zeroes velocity when no movementTarget', () => {
		const agent = createAgentWithBa('agent-3', 50, 50);

		const system = createMovementSystem(() => [agent], () => []);

		expect(() => { system.execute(createDeps()); }).not.toThrow();
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
		expect(agent.pos.x).toBeCloseTo(50);
		expect(agent.pos.y).toBeCloseTo(50);
	});

	it('sets velocity toward another agent target', () => {
		const agent1 = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'agent-2', type: 'agent' },
		});
		const agent2 = createAgentWithBa('agent-2', 200, 0);

		const system = createMovementSystem(() => [agent1, agent2], () => []);

		system.execute(createDeps());

		// Velocity should point toward agent2 (positive x)
		expect(agent1.vel.x).toBeGreaterThan(0);
		expect(agent1.vel.y).toBeCloseTo(0);
	});

	it('higher DX produces higher velocity', () => {
		const slowAgent = createAgentWithBa('slow', 0, 0, { attributes: { ST: 10, DX: 4, IQ: 10, HT: 10 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});
		const fastAgent = createAgentWithBa('fast', 0, 0, { attributes: { ST: 10, DX: 20, IQ: 10, HT: 10 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1000, 0)];
		const system = createMovementSystem(() => [slowAgent, fastAgent], () => locations);

		system.execute(createDeps());

		// Fast agent has higher velocity
		expect(fastAgent.vel.x).toBeGreaterThan(slowAgent.vel.x);
	});

	it('moving agent loses energy each tick', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 90, social: 70 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		const needs = agent.get(NeedsComponent);
		// DX=10, divisor=4 -> speedPerTick=2.5, movement_energy_cost=0.02 -> drain=0.05
		expect(needs.state.energy).toBe(90 - 0.05);
	});

	it('exhausted agent moves at half speed', () => {
		// energy < 15 (NEED_CRITICAL_THRESHOLDS.energy) -> exhaustion_speed_modifier = 0.5
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 10, social: 70 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Normal speed: DX=10, divisor=4, interval=500ms -> 5.0 px/sec
		// Exhausted: 5.0 * 0.5 = 2.5 px/sec
		expect(agent.vel.x).toBeCloseTo(2.5, 2);
	});

	it('does not re-arrive when agent is already at target location', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentArrived', (e) => { events.push(e); });

		const agent = createAgentWithBa('agent-1', 10, 0, {}, {
			atLocation: 'loc-food-1',
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 10, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		// movementTarget should be consumed silently
		expect(agent.behaviorAgent.movementTarget).toBeNull();
		// atLocation should be preserved
		expect(agent.behaviorAgent.atLocation).toBe('loc-food-1');
		// No arrival event — agent was already there
		expect(events.length).toBe(0);
		// Agent should not be moving
		expect(agent.vel.x).toBe(0);
		expect(agent.vel.y).toBe(0);
	});

	it('populates knownLocations on first arrival at a location', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		expect(agent.behaviorAgent.knownLocations).toContain('loc-food-1');
	});

	it('does not duplicate knownLocations on repeat arrival', () => {
		const agent = createAgentWithBa('agent-1', 0, 0, {}, {
			knownLocations: ['loc-food-1'],
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 1, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		expect(agent.behaviorAgent.knownLocations.filter(l => l === 'loc-food-1')).toHaveLength(1);
	});

	it('emits AgentExhausted when energy crosses 0', () => {
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('AgentExhausted', (e) => { events.push(e); });

		// Start with very low energy that will cross 0 (drain = speed 2.5 * cost 0.02 = 0.05)
		const agent = createAgentWithBa('agent-1', 0, 0, { needs: { hunger: 80, energy: 0.01, social: 70 } }, {
			movementTarget: { id: 'loc-food-1', type: 'location' },
		});

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');

		const needs = agent.get(NeedsComponent);
		expect(needs.state.energy).toBe(0);
	});
});
