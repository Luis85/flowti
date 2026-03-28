import { describe, it, expect } from 'vitest';
import { createMovementSystem } from '../../../src/infrastructure/systems/movement-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
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
		behavior_tree: 'bt/merchant.md',
		job: null,
		property: [],
		...overrides,
	};
}

function createTestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'food', position: { x, y, region: 'test' }, capacity: 10 };
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
	};
}

describe('MovementSystem', () => {
	it('moves agent toward target location', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);

		// Set movementTarget to a location
		const bb = agent.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 100, 0)];
		const system = createMovementSystem(() => [agent], () => locations);

		system.execute(createDeps());

		// Agent should have moved toward (100, 0)
		expect(agent.pos.x).toBeGreaterThan(0);
		expect(agent.pos.x).toBeLessThan(100);
		expect(agent.pos.y).toBeCloseTo(0);
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
	});

	it('skips agents with no movementTarget', () => {
		const agent = new AgentActor(createTestAgentData('agent-3', 50, 50), defaultMoodConfig);
		// No movementTarget set in blackboard

		const system = createMovementSystem(() => [agent], () => []);

		// Should not throw and position should remain unchanged
		expect(() => system.execute(createDeps())).not.toThrow();
		expect(agent.pos.x).toBeCloseTo(50);
		expect(agent.pos.y).toBeCloseTo(50);
	});

	it('moves agent toward another agent target', () => {
		const agent1 = new AgentActor(createTestAgentData('agent-1', 0, 0), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData('agent-2', 200, 0), defaultMoodConfig);

		const bb = agent1.get(BlackboardComponent);
		bb.state = { ...bb.state, movementTarget: { id: 'agent-2', type: 'agent' } };

		const system = createMovementSystem(() => [agent1, agent2], () => []);

		system.execute(createDeps());

		// agent1 should have moved toward agent2
		expect(agent1.pos.x).toBeGreaterThan(0);
		expect(agent1.pos.x).toBeLessThan(200);
	});

	it('uses DX attribute for speed calculation', () => {
		const slowAgent = new AgentActor(createTestAgentData('slow', 0, 0, { attributes: { ST: 10, DX: 4, IQ: 10, HT: 10 } }), defaultMoodConfig);
		const fastAgent = new AgentActor(createTestAgentData('fast', 0, 0, { attributes: { ST: 10, DX: 20, IQ: 10, HT: 10 } }), defaultMoodConfig);

		const slowBb = slowAgent.get(BlackboardComponent);
		slowBb.state = { ...slowBb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const fastBb = fastAgent.get(BlackboardComponent);
		fastBb.state = { ...fastBb.state, movementTarget: { id: 'loc-food-1', type: 'location' } };

		const locations = [createTestLocation('loc-food-1', 1000, 0)];
		const system = createMovementSystem(() => [slowAgent, fastAgent], () => locations);

		system.execute(createDeps());

		// Fast agent moved more than slow agent
		expect(fastAgent.pos.x).toBeGreaterThan(slowAgent.pos.x);
	});
});
