import { describe, it, expect, vi } from 'vitest';
import { createTickRunner } from '../../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { SystemPriority } from '../../../src/domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameSystem } from '../../../src/domain/core/tick-scheduler.js';

function createTestDeps(eventBus = createEventBus()): { deps: GameCoreDeps; eventBus: ReturnType<typeof createEventBus> } {
	const deps: GameCoreDeps = {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 0,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
	return { deps, eventBus };
}

function createMockSystem(name: string, priority: number, fn?: (deps: GameCoreDeps) => void): GameSystem {
	return { name, priority, execute: fn ?? (() => {}) };
}

describe('TickRunner', () => {
	it('executes systems in priority order', () => {
		const order: string[] = [];
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('B', 10, () => order.push('B')));
		runner.register(createMockSystem('A', 1, () => order.push('A')));
		runner.register(createMockSystem('C', 20, () => order.push('C')));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(order).toEqual(['A', 'B', 'C']);
	});

	it('increments tickCount after all systems complete', () => {
		const runner = createTickRunner(createEventBus());
		const { deps } = createTestDeps();

		expect(runner.tickCount).toBe(0);
		runner.tick(deps);
		expect(runner.tickCount).toBe(1);
		runner.tick(deps);
		expect(runner.tickCount).toBe(2);
	});

	it('sets deps.tickCount to current tick before systems execute', () => {
		let capturedTick = -1;
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('Capture', 1, (d) => { capturedTick = d.tickCount; }));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(capturedTick).toBe(1);
	});

	it('skips failing system and continues with next', () => {
		const order: string[] = [];
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('Good1', 1, () => order.push('Good1')));
		runner.register(createMockSystem('Bad', 2, () => { throw new Error('boom'); }));
		runner.register(createMockSystem('Good2', 3, () => order.push('Good2')));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(order).toEqual(['Good1', 'Good2']);
	});

	it('calls beginBatch/flushBatch around each system', () => {
		const eventBus = createEventBus();
		const beginSpy = vi.spyOn(eventBus, 'beginBatch');
		const flushSpy = vi.spyOn(eventBus, 'flushBatch');

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('A', 1));
		runner.register(createMockSystem('B', 2));

		const { deps } = createTestDeps(eventBus);
		runner.tick(deps);

		expect(beginSpy).toHaveBeenCalledTimes(2);
		expect(flushSpy).toHaveBeenCalledTimes(2);
	});

	it('emits SystemError event when system fails', () => {
		const eventBus = createEventBus();
		const errors: { systemName: unknown; message: unknown }[] = [];
		eventBus.on('SystemError', (e) => { errors.push(e.payload as { systemName: unknown; message: unknown }); });

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Broken', 1, () => { throw new Error('kaboom'); }));

		const { deps } = createTestDeps(eventBus);
		runner.tick(deps);

		expect(errors).toHaveLength(1);
		expect(errors[0]?.systemName).toBe('Broken');
		expect(errors[0]?.message).toBe('kaboom');
	});

	it('flushBatch still called after system failure (finally block)', () => {
		const eventBus = createEventBus();
		const flushSpy = vi.spyOn(eventBus, 'flushBatch');

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Fail', 1, () => { throw new Error('boom'); }));

		const { deps } = createTestDeps(eventBus);
		runner.tick(deps);

		expect(flushSpy).toHaveBeenCalledOnce();
	});

	it('logs error with system name when system fails', () => {
		const eventBus = createEventBus();
		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Crasher', 1, () => { throw new Error('oops'); }));

		const { deps } = createTestDeps(eventBus);
		const errorSpy = vi.spyOn(deps.logger, 'error');
		runner.tick(deps);

		expect(errorSpy).toHaveBeenCalledOnce();
		expect(errorSpy.mock.calls[0]?.[0]).toBe('TickRunner');
		expect(errorSpy.mock.calls[0]?.[1]).toContain('Crasher');
		expect(errorSpy.mock.calls[0]?.[1]).toContain('oops');
	});

	it('records performance timing when enabled', () => {
		const eventBus = createEventBus();
		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Sys', 1));

		const { deps } = createTestDeps(eventBus);
		deps.performanceTracker.setEnabled(true);
		runner.tick(deps);

		const history = deps.performanceTracker.history();
		expect(history).toHaveLength(1);
		expect(history[0]?.systems[0]?.name).toBe('Sys');
	});

	it('handles empty runner with no systems', () => {
		const runner = createTickRunner(createEventBus());
		const { deps } = createTestDeps();
		expect(() => { runner.tick(deps); }).not.toThrow();
		expect(runner.tickCount).toBe(1);
	});

	it('delivers events from system A to system B via batch flush', () => {
		const eventBus = createEventBus();
		let received = false;

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Emitter', 1, (d) => {
			d.eventBus.emit({ type: 'TestEvent', tick: d.tickCount, wallClock: Date.now(), source: 'Emitter', payload: {} });
		}));
		runner.register(createMockSystem('Receiver', 2, () => {}));

		eventBus.on('TestEvent', () => { received = true; });

		const { deps } = createTestDeps(eventBus);
		runner.tick(deps);

		expect(received).toBe(true);
	});

	it('deps.tickCount persists after tick completes', () => {
		const runner = createTickRunner(createEventBus());
		const { deps } = createTestDeps();

		runner.tick(deps);
		expect(deps.tickCount).toBe(1);

		runner.tick(deps);
		expect(deps.tickCount).toBe(2);
	});

	it('sorts fractional priorities correctly', () => {
		const order: string[] = [];
		const runner = createTickRunner(createEventBus());
		runner.register(createMockSystem('Movement', 5.5, () => order.push('Movement')));
		runner.register(createMockSystem('BehaviorTree', 5, () => order.push('BehaviorTree')));
		runner.register(createMockSystem('TraitResolver', 0.5, () => order.push('TraitResolver')));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(order).toEqual(['TraitResolver', 'BehaviorTree', 'Movement']);
	});

	it('emits TickBudgetExceeded when tick exceeds budget', () => {
		const eventBus = createEventBus();
		const events: unknown[] = [];
		eventBus.on('TickBudgetExceeded', (e) => { events.push(e); });

		const runner = createTickRunner(eventBus);
		// Create a slow system that artificially delays
		runner.register(createMockSystem('SlowSystem', 1, () => {
			const start = performance.now();
			while (performance.now() - start < 350) { /* spin */ }
		}));

		const { deps } = createTestDeps(eventBus);
		deps.performanceTracker.setEnabled(true);
		runner.tick(deps);

		expect(events.length).toBe(1);
		const event = events[0] as { type: string; payload: { elapsedMs: number } };
		expect(event.type).toBe('TickBudgetExceeded');
		expect(event.payload.elapsedMs).toBeGreaterThan(300);
	});

	it('does not emit TickBudgetExceeded when tick is within budget', () => {
		const eventBus = createEventBus();
		const events: unknown[] = [];
		eventBus.on('TickBudgetExceeded', (e) => { events.push(e); });

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('FastSystem', 1));

		const { deps } = createTestDeps(eventBus);
		deps.performanceTracker.setEnabled(true);
		runner.tick(deps);

		expect(events.length).toBe(0);
	});

	it('SystemPriority constants match GDD numbering', () => {
		expect(SystemPriority.TRAIT_RESOLVER).toBe(0.5);
		expect(SystemPriority.DAY_NIGHT).toBe(0.7);
		expect(SystemPriority.NEEDS_DECAY).toBe(1);
		expect(SystemPriority.MOOD).toBe(2);
		expect(SystemPriority.PERCEPTION).toBe(3);
		expect(SystemPriority.MEMORY).toBe(4);
		expect(SystemPriority.BEHAVIOR_TREE).toBe(5);
		expect(SystemPriority.MOVEMENT).toBe(5.5);
		expect(SystemPriority.JOB).toBe(5.8);
		expect(SystemPriority.QUEST_EVALUATION).toBe(7);
		expect(SystemPriority.OBJECT_INTERACTION).toBe(8);
		expect(SystemPriority.TOOL_EXECUTION).toBe(9);
		expect(SystemPriority.CONSTRUCTION).toBe(10);
		expect(SystemPriority.TRADE).toBe(11);
		expect(SystemPriority.DIALOGUE).toBe(12);
		expect(SystemPriority.GOSSIP).toBe(12.5);
		expect(SystemPriority.PROGRESSION).toBe(13);
		expect(SystemPriority.RELATIONSHIP).toBe(14);
		expect(SystemPriority.ITEM_DURABILITY).toBe(15);
		expect(SystemPriority.ECONOMY).toBe(16);
		expect(SystemPriority.WORLD_EVENT).toBe(17);
		expect(SystemPriority.SEASON).toBe(17.5);
		expect(SystemPriority.NOTIFICATION).toBe(18);
		expect(SystemPriority.CHRONICLER).toBe(18.5);
		expect(SystemPriority.SCENARIO).toBe(18.7);
		expect(SystemPriority.ABANDONMENT).toBe(18.8);
		expect(SystemPriority.VAULT_SYNC).toBe(19);
		expect(SystemPriority.UI_BRIDGE).toBe(20);
	});
});
