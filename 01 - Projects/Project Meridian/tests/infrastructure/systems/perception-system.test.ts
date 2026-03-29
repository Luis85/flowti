import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createPerceptionSystem } from '../../../src/infrastructure/systems/perception-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(overrides: Record<string, unknown> = {}) {
	return {
		id: 'agent-1',
		name: 'Alice',
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
		position: { x: 0, y: 0, region: 'test' },
		relationships: '',
		tools: [],
		color: '#b0b0b0', behavior_tree: 'bt/merchant.md',
		job: null,
		property: [],
		...overrides,
	};
}

function createWorldEntityWithPhase(phase: 'dawn' | 'day' | 'dusk' | 'night'): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase, tickInCycle: 0, dayCount: 0 }));
	return actor;
}

function createTestLocation(id: string, x: number, y: number): WorldLocation {
	return { id, name: id, type: 'food', position: { x, y, region: 'test' }, capacity: 10, color: '#808080' };
}

function createDeps(tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
	};
}

describe('PerceptionSystem', () => {
	it('writes PerceptionComponent on each agent', () => {
		const agent = new AgentActor(createTestAgentData(), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));
		const worldEntity = createWorldEntityWithPhase('day');

		// Place a location within IQ*base_multiplier range (IQ=10, multiplier=20 → radius=200)
		const locations = [createTestLocation('loc-food-1', 50, 0)];

		const system = createPerceptionSystem(() => [agent], () => locations, () => worldEntity);
		system.execute(createDeps());

		const perception = agent.get(PerceptionComponent);
		expect(perception.state.nearbyLocations).toHaveLength(1);
		expect(perception.state.nearbyLocations[0]?.id).toBe('loc-food-1');
		expect(perception.dirty).toBe(true);
	});

	it('excludes the agent itself from nearbyAgents', () => {
		const agent1 = new AgentActor(createTestAgentData({ id: 'agent-1', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		agent1.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Same position — would appear nearby if not excluded
		const agent2 = new AgentActor(createTestAgentData({ id: 'agent-2', name: 'Bob', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		agent2.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = createWorldEntityWithPhase('day');
		const system = createPerceptionSystem(() => [agent1, agent2], () => [], () => worldEntity);
		system.execute(createDeps());

		const p1 = agent1.get(PerceptionComponent);
		// agent-1 should see agent-2 but NOT itself
		expect(p1.state.nearbyAgents.map(a => a.id)).not.toContain('agent-1');
		expect(p1.state.nearbyAgents.map(a => a.id)).toContain('agent-2');
	});

	it('handles multiple agents writing perception independently', () => {
		// Place agents far apart — neither should see the other
		const agent1 = new AgentActor(createTestAgentData({ id: 'agent-1', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		agent1.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const agent2 = new AgentActor(createTestAgentData({ id: 'agent-2', name: 'Bob', position: { x: 5000, y: 5000, region: 'test' } }), defaultMoodConfig);
		agent2.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = createWorldEntityWithPhase('day');
		const system = createPerceptionSystem(() => [agent1, agent2], () => [], () => worldEntity);
		system.execute(createDeps());

		expect(agent1.get(PerceptionComponent).state.nearbyAgents).toHaveLength(0);
		expect(agent2.get(PerceptionComponent).state.nearbyAgents).toHaveLength(0);
	});

	it('applies night multiplier — reduces perception radius at night', () => {
		// IQ=10, base_multiplier=20 → day radius=200
		// night_multiplier=0.5 → night radius=200*0.5=100
		// Location at distance 150: visible during day (200>150), not visible at night (100<150)
		const agent = new AgentActor(createTestAgentData(), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const dayEntity = createWorldEntityWithPhase('day');
		const nightEntity = createWorldEntityWithPhase('night');

		const locations = [createTestLocation('loc-mid-1', 150, 0)];
		const system = createPerceptionSystem(() => [agent], () => locations, () => dayEntity);
		system.execute(createDeps());
		const dayPerception = agent.get(PerceptionComponent);
		// day radius=200, location at 150 → visible
		expect(dayPerception.state.nearbyLocations).toHaveLength(1);

		// Reset perception
		agent.get(PerceptionComponent).state = { nearbyAgents: [], nearbyLocations: [] };

		const systemNight = createPerceptionSystem(() => [agent], () => locations, () => nightEntity);
		systemNight.execute(createDeps());
		const nightPerception = agent.get(PerceptionComponent);
		// night radius=200*0.5=100, location at 150 → not visible
		expect(nightPerception.state.nearbyLocations).toHaveLength(0);
	});
});
