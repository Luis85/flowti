import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createBehaviorTreeSystem } from '../../../src/infrastructure/systems/behavior-tree-system.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { PerceptionComponent } from '../../../src/infrastructure/components/perception-component.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { BlackboardComponent } from '../../../src/infrastructure/components/blackboard-component.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { BTNode } from '../../../src/domain/systems/behavior-tree.js';

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [{ name: 'stressed', min: -100, max: 100 }],
	external_modifier_cap: 30,
};

function createTestAgentData(id: string, kind: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: id,
		kind,
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
		behavior_tree: `bt/${kind}.md`,
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

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
	};
}

/** A simple BT that always selects the 'wander' action */
const wanderBT: BTNode = {
	type: 'action',
	action: 'wander',
	params: {},
};

/** A BT that seeks food when hunger is critical (< 20), otherwise wanders */
const hungerBT: BTNode = {
	type: 'selector',
	children: [
		{
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'hunger' } },
				{ type: 'action', action: 'seek_food', params: {} },
			],
		},
		{ type: 'action', action: 'wander', params: {} },
	],
};

describe('BehaviorTreeSystem', () => {
	it('selects action from BT and writes to BlackboardComponent', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 'merchant'), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = createWorldEntityWithPhase('day');
		const btDefs: Record<string, BTNode> = { merchant: wanderBT };
		const system = createBehaviorTreeSystem(
			() => [agent],
			btDefs,
			() => worldEntity,
			42,
		);

		system.execute(createDeps());

		const bb = agent.get(BlackboardComponent);
		expect(bb.state.btAction).toBe('wander');
	});

	it('emits BTActionSelected event with agentId and action', () => {
		const agent = new AgentActor(createTestAgentData('agent-1', 'merchant'), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('BTActionSelected', (e) => { events.push(e); });

		const worldEntity = createWorldEntityWithPhase('day');
		const btDefs: Record<string, BTNode> = { merchant: wanderBT };
		const system = createBehaviorTreeSystem(() => [agent], btDefs, () => worldEntity, 42);

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.agentId).toBe('agent-1');
		expect(events[0]?.payload.action).toBe('wander');
	});

	it('selects seek_food when hunger is critical', () => {
		// Set hunger below critical threshold (20)
		const agent = new AgentActor(
			createTestAgentData('agent-2', 'guard', { needs: { hunger: 5, energy: 90, social: 70 } }),
			defaultMoodConfig,
		);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Patch the needs state directly so hunger is truly critical
		agent.get(NeedsComponent).state = { hunger: 5, energy: 90, social: 70 };

		const worldEntity = createWorldEntityWithPhase('day');
		const btDefs: Record<string, BTNode> = { guard: hungerBT };
		const system = createBehaviorTreeSystem(() => [agent], btDefs, () => worldEntity, 99);

		system.execute(createDeps());

		expect(agent.get(BlackboardComponent).state.btAction).toBe('seek_food');
	});

	it('falls back to wander when hunger is not critical', () => {
		const agent = new AgentActor(
			createTestAgentData('agent-3', 'guard', { needs: { hunger: 80, energy: 90, social: 70 } }),
			defaultMoodConfig,
		);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = createWorldEntityWithPhase('day');
		const btDefs: Record<string, BTNode> = { guard: hungerBT };
		const system = createBehaviorTreeSystem(() => [agent], btDefs, () => worldEntity, 99);

		system.execute(createDeps());

		expect(agent.get(BlackboardComponent).state.btAction).toBe('wander');
	});

	it('skips agent when no BT definition exists for its kind', () => {
		const agent = new AgentActor(createTestAgentData('agent-4', 'villager'), defaultMoodConfig);
		agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		const worldEntity = createWorldEntityWithPhase('day');
		const btDefs: Record<string, BTNode> = { merchant: wanderBT };
		const system = createBehaviorTreeSystem(() => [agent], btDefs, () => worldEntity, 42);

		// Should not throw
		expect(() => { system.execute(createDeps()); }).not.toThrow();

		const bb = agent.get(BlackboardComponent);
		// No action written since no BT found
		expect(bb.state.btAction).toBeUndefined();
	});
});
