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
	};
}

function createMockAgent(): AgentActor {
	const stepFn = vi.fn();
	return {
		behaviorTree: { step: stepFn },
		_stepFn: stepFn,
	} as unknown as AgentActor & { _stepFn: ReturnType<typeof vi.fn> };
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
});
