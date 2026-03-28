import { describe, it, expect, vi } from 'vitest';
import { createTickRunner } from '../../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { SystemPriority } from '../../../src/domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameSystem } from '../../../src/domain/core/tick-scheduler.js';

function createTestDeps(): { deps: GameCoreDeps; eventBus: ReturnType<typeof createEventBus> } {
	const eventBus = createEventBus();
	const deps: GameCoreDeps = {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount: 0,
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

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(beginSpy).toHaveBeenCalledTimes(2);
		expect(flushSpy).toHaveBeenCalledTimes(2);
	});

	it('flushBatch still called after system failure (finally block)', () => {
		const eventBus = createEventBus();
		const flushSpy = vi.spyOn(eventBus, 'flushBatch');

		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Fail', 1, () => { throw new Error('boom'); }));

		const { deps } = createTestDeps();
		runner.tick(deps);

		expect(flushSpy).toHaveBeenCalledOnce();
	});

	it('records performance timing when enabled', () => {
		const eventBus = createEventBus();
		const runner = createTickRunner(eventBus);
		runner.register(createMockSystem('Sys', 1));

		const { deps } = createTestDeps();
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

		const { deps } = createTestDeps();
		deps.eventBus = eventBus;
		runner.tick(deps);

		expect(received).toBe(true);
	});

	it('SystemPriority constants match GDD numbering', () => {
		expect(SystemPriority.NEEDS_DECAY).toBe(1);
		expect(SystemPriority.MOOD).toBe(2);
		expect(SystemPriority.BEHAVIOR_TREE).toBe(5);
		expect(SystemPriority.VAULT_SYNC).toBe(19);
		expect(SystemPriority.UI_BRIDGE).toBe(20);
	});
});
