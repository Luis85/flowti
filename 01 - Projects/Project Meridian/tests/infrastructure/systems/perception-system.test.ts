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
import type { BehaviorAgent } from '../../../src/domain/systems/behavior-agent.js';

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
		needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
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
	actor.addComponent(new TimeComponent({ phase, tickInCycle: 0, dayCount: 0, dayBoundaryThisTick: false }));
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
		writeFile: null,
		dataRoot: 'test-data',
	};
}

describe('PerceptionSystem', () => {
	it('writes PerceptionComponent on each agent', () => {
		const agent = new AgentActor(createTestAgentData(), defaultMoodConfig);
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

		// Same position — would appear nearby if not excluded
		const agent2 = new AgentActor(createTestAgentData({ id: 'agent-2', name: 'Bob', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);

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

		const agent2 = new AgentActor(createTestAgentData({ id: 'agent-2', name: 'Bob', position: { x: 5000, y: 5000, region: 'test' } }), defaultMoodConfig);

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

	it('agent inside facility is excluded from other agents nearbyAgents', () => {
		// Both agents at same position — normally visible to each other
		const outsideAgent = new AgentActor(createTestAgentData({ id: 'outside', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		const insideAgent = new AgentActor(createTestAgentData({ id: 'inside', name: 'Bob', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);

		// Set behaviorAgent stubs — insideAgent is inside a facility
		outsideAgent.behaviorAgent = { insideFacility: false, atLocation: null } as unknown as BehaviorAgent;
		insideAgent.behaviorAgent = { insideFacility: true, atLocation: 'loc-farm' } as unknown as BehaviorAgent;

		const worldEntity = createWorldEntityWithPhase('day');
		const system = createPerceptionSystem(() => [outsideAgent, insideAgent], () => [], () => worldEntity);
		system.execute(createDeps());

		const outsidePerception = outsideAgent.get(PerceptionComponent);
		// Outside agent should NOT see the inside agent
		expect(outsidePerception.state.nearbyAgents.map(a => a.id)).not.toContain('inside');
	});

	it('agent inside facility only sees agents at the same location', () => {
		const insideAgent1 = new AgentActor(createTestAgentData({ id: 'inside-1', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		const insideAgent2 = new AgentActor(createTestAgentData({ id: 'inside-2', name: 'Bob', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		const insideOtherLoc = new AgentActor(createTestAgentData({ id: 'inside-other', name: 'Carol', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);

		// inside-1 and inside-2 share location 'loc-farm'; inside-other is at 'loc-mine'
		insideAgent1.behaviorAgent = { insideFacility: true, atLocation: 'loc-farm' } as unknown as BehaviorAgent;
		insideAgent2.behaviorAgent = { insideFacility: true, atLocation: 'loc-farm' } as unknown as BehaviorAgent;
		insideOtherLoc.behaviorAgent = { insideFacility: true, atLocation: 'loc-mine' } as unknown as BehaviorAgent;

		const worldEntity = createWorldEntityWithPhase('day');
		const system = createPerceptionSystem(
			() => [insideAgent1, insideAgent2, insideOtherLoc],
			() => [],
			() => worldEntity,
		);
		system.execute(createDeps());

		const p1 = insideAgent1.get(PerceptionComponent);
		// inside-1 should see inside-2 (same location) but NOT inside-other (different location)
		expect(p1.state.nearbyAgents.map(a => a.id)).toContain('inside-2');
		expect(p1.state.nearbyAgents.map(a => a.id)).not.toContain('inside-other');
	});

	it('agent NOT inside facility sees normally (no facility filtering)', () => {
		const agent1 = new AgentActor(createTestAgentData({ id: 'agent-1', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);
		const agent2 = new AgentActor(createTestAgentData({ id: 'agent-2', name: 'Bob', position: { x: 0, y: 0, region: 'test' } }), defaultMoodConfig);

		// Neither agent is inside a facility
		agent1.behaviorAgent = { insideFacility: false, atLocation: null } as unknown as BehaviorAgent;
		agent2.behaviorAgent = { insideFacility: false, atLocation: null } as unknown as BehaviorAgent;

		const worldEntity = createWorldEntityWithPhase('day');
		const system = createPerceptionSystem(() => [agent1, agent2], () => [], () => worldEntity);
		system.execute(createDeps());

		const p1 = agent1.get(PerceptionComponent);
		// Both agents visible to each other as normal
		expect(p1.state.nearbyAgents.map(a => a.id)).toContain('agent-2');
	});
});
