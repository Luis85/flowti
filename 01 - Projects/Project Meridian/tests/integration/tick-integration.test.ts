import { describe, it, expect } from 'vitest';
import { createTickRunner } from '../../src/infrastructure/engine/tick-runner.js';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import { createPerformanceTracker } from '../../src/infrastructure/performance/performance-tracker.js';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import type { GameCoreDeps } from '../../src/domain/core/game-deps.js';
import type { GameSystem } from '../../src/domain/core/tick-scheduler.js';

function createIntegrationDeps(
	eventBus: ReturnType<typeof createEventBus>,
	perfTracker = createPerformanceTracker(),
): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: perfTracker,
		tickCount: 0,
	};
}

describe('Tick Integration', () => {
	it('system A emits event, system B receives it via batch flush', () => {
		const eventBus = createEventBus();
		let receivedByB = false;

		eventBus.on('FromA', () => { receivedByB = true; });

		const systemA: GameSystem = {
			name: 'SystemA', priority: 1,
			execute(deps) {
				deps.eventBus.emit({ type: 'FromA', tick: deps.tickCount, wallClock: Date.now(), source: 'SystemA', payload: {} });
			},
		};
		const systemB: GameSystem = {
			name: 'SystemB', priority: 2,
			execute() {},
		};

		const runner = createTickRunner(eventBus);
		runner.register(systemA);
		runner.register(systemB);

		const deps = createIntegrationDeps(eventBus);
		runner.tick(deps);

		expect(receivedByB).toBe(true);
	});

	it('system A fails, system B still executes', () => {
		const eventBus = createEventBus();
		let bExecuted = false;

		const systemA: GameSystem = {
			name: 'FailingA', priority: 1,
			execute() { throw new Error('A crashed'); },
		};
		const systemB: GameSystem = {
			name: 'HealthyB', priority: 2,
			execute() { bExecuted = true; },
		};

		const runner = createTickRunner(eventBus);
		runner.register(systemA);
		runner.register(systemB);

		const deps = createIntegrationDeps(eventBus);
		runner.tick(deps);

		expect(bExecuted).toBe(true);
	});

	it('performance tracker records timing for all systems', () => {
		const eventBus = createEventBus();
		const perfTracker = createPerformanceTracker();
		perfTracker.setEnabled(true);

		const runner = createTickRunner(eventBus);
		runner.register({ name: 'Sys1', priority: 1, execute() {} });
		runner.register({ name: 'Sys2', priority: 2, execute() {} });

		const deps = createIntegrationDeps(eventBus, perfTracker);
		runner.tick(deps);

		const history = perfTracker.history();
		expect(history).toHaveLength(1);
		expect(history[0]?.systems).toHaveLength(2);
		expect(history[0]?.systems[0]?.name).toBe('Sys1');
		expect(history[0]?.systems[1]?.name).toBe('Sys2');
	});
});
