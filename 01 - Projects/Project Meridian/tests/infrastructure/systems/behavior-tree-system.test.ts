import { describe, it, expect, vi } from 'vitest';
import { createBehaviorTreeSystem } from '../../../src/infrastructure/systems/behavior-tree-system.js';
import { SystemPriority } from '../../../src/domain/core/tick-scheduler.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';

function createDeps(): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 1,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

function createMockAgent(): AgentActor {
	const stepFn = vi.fn();
	const resetFn = vi.fn();
	return {
		agentId: 'agent-test',
		behaviorAgent: {
			btAction: null as string | null,
			tickUnemployment: vi.fn(),
			committedAction: null as string | null,
			commitmentTicks: 0,
		},
		behaviorTree: {
			step: stepFn,
			reset: resetFn,
			getTreeNodeDetails: vi.fn().mockImplementation(() => { throw new Error('no tree'); }),
		},
		_stepFn: stepFn,
		_resetFn: resetFn,
	} as unknown as AgentActor & { _stepFn: ReturnType<typeof vi.fn>; _resetFn: ReturnType<typeof vi.fn> };
}

describe('BehaviorTreeSystem (mistreevous thin wrapper)', () => {
	it('has name BehaviorTreeSystem', () => {
		const system = createBehaviorTreeSystem(() => []);
		expect(system.name).toBe('BehaviorTreeSystem');
	});

	it('has BEHAVIOR_TREE priority', () => {
		const system = createBehaviorTreeSystem(() => []);
		expect(system.priority).toBe(SystemPriority.BEHAVIOR_TREE);
	});

	it('calls step() on each agent behaviorTree', () => {
		const agent1 = createMockAgent();
		const agent2 = createMockAgent();
		const system = createBehaviorTreeSystem(() => [agent1, agent2]);

		system.execute(createDeps());

		expect((agent1 as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn).toHaveBeenCalledOnce();
		expect((agent2 as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn).toHaveBeenCalledOnce();
	});

	it('handles empty agent list', () => {
		const system = createBehaviorTreeSystem(() => []);
		expect(() => { system.execute(createDeps()); }).not.toThrow();
	});

	it('resets btAction to null before each BT step', () => {
		const agent = createMockAgent();
		// Simulate a stale btAction from a previous tick
		agent.behaviorAgent.btAction = 'eat';
		const system = createBehaviorTreeSystem(() => [agent]);

		system.execute(createDeps());

		// btAction must be null after execute (step() mock doesn't set a new one)
		expect(agent.behaviorAgent.btAction).toBeNull();
	});

	it('resets btAction before step() is called, not after', () => {
		const agent = createMockAgent();
		agent.behaviorAgent.btAction = 'rest';
		let btActionDuringStep: string | null = 'not-checked';
		(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
			btActionDuringStep = agent.behaviorAgent.btAction;
		});
		const system = createBehaviorTreeSystem(() => [agent]);

		system.execute(createDeps());

		// btAction should already be null when step() runs
		expect(btActionDuringStep).toBeNull();
	});

	it('emits BtEvaluated event after each agent step', () => {
		const agent = createMockAgent();
		// Override getTreeNodeDetails to return a minimal tree
		(agent.behaviorTree as Record<string, unknown>).getTreeNodeDetails = vi.fn().mockReturnValue({
			name: 'ROOT', type: 'root', state: 'mistreevous.running',
			children: [{ name: 'Eat', type: 'action', state: 'mistreevous.running', children: [] }],
		});

		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		system.execute(deps);

		const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
		expect(btEvents).toHaveLength(1);
		expect(btEvents[0]![0].source).toBe('BehaviorTreeSystem');
		expect(btEvents[0]![0].payload).toMatchObject({
			agentId: 'agent-test',
			leaf: 'Eat',
			leafStatus: 'RUNNING',
		});
	});

	it('emits BtEvaluated with unknown leaf when getTreeNodeDetails throws', () => {
		const agent = createMockAgent();
		// Default mock already throws — no override needed

		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		system.execute(deps);

		const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
		expect(btEvents).toHaveLength(1);
		expect(btEvents[0]![0].payload).toMatchObject({
			leaf: 'unknown',
			leafStatus: 'unknown',
		});
	});

	it('emits ActionChanged when btAction changes between ticks', () => {
		const agent = createMockAgent();
		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		// Tick 1: btAction stays null (step mock doesn't set it)
		system.execute(deps);

		// Tick 2: step sets btAction to 'work'
		(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
			agent.behaviorAgent.btAction = 'work';
		});
		deps.tickCount = 2;
		system.execute(deps);

		const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
		expect(changed).toHaveLength(1);
		expect(changed[0]![0].payload).toMatchObject({
			agentId: 'agent-test',
			previousAction: null,
			newAction: 'work',
			preempted: false,
		});
	});

	it('sets preempted=true when both old and new actions are non-null', () => {
		const agent = createMockAgent();
		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		// Tick 1: set action to 'seek_well'
		(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
			agent.behaviorAgent.btAction = 'seek_well';
		});
		system.execute(deps);

		// Tick 2: action changes to 'seek_market'
		(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
			agent.behaviorAgent.btAction = 'seek_market';
		});
		deps.tickCount = 2;
		system.execute(deps);

		const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
		expect(changed).toHaveLength(2); // null→seek_well, seek_well→seek_market
		const preemption = changed[1]![0].payload;
		expect(preemption.preempted).toBe(true);
		expect(preemption.previousAction).toBe('seek_well');
		expect(preemption.newAction).toBe('seek_market');
	});

	it('does not emit ActionChanged when btAction stays the same', () => {
		const agent = createMockAgent();
		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		// Both ticks: btAction = 'work'
		(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
			agent.behaviorAgent.btAction = 'work';
		});
		system.execute(deps);
		deps.tickCount = 2;
		system.execute(deps);

		const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
		expect(changed).toHaveLength(1); // only the initial null→work
	});

	it('throttles BtEvaluated — only emits when leaf changes', () => {
		const agent = createMockAgent();
		(agent.behaviorTree as Record<string, unknown>).getTreeNodeDetails = vi.fn().mockReturnValue({
			name: 'ROOT', type: 'root', state: 'mistreevous.running',
			children: [{ name: 'Eat', type: 'action', state: 'mistreevous.running', children: [] }],
		});
		const deps = createDeps();
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');
		const system = createBehaviorTreeSystem(() => [agent]);

		// Tick 1: leaf=Eat — emit
		system.execute(deps);
		// Tick 2: leaf=Eat again — throttled
		deps.tickCount = 2;
		system.execute(deps);

		const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
		expect(btEvents).toHaveLength(1); // only first tick emits
	});
});
