import { describe, it, expect } from 'vitest';
import { MeridianTickSystem } from '../../../src/infrastructure/engine/tick-system.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import type { TickScheduler } from '../../../src/domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';

function createMockTickRunner(): TickScheduler & { tickCalls: number } {
	return {
		tickCount: 0,
		tickCalls: 0,
		register() {},
		tick() { this.tickCalls++; },
	};
}

function createMockDeps(): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: { emit() {}, on: () => () => {}, off() {}, onAny: () => () => {}, filter: () => () => {}, history: () => [] },
		config: GameConfigSchema.parse({ tick_interval_ms: 500 }),
		performanceTracker: { enabled: false, setEnabled() {}, startSystem() {}, endSystem() {}, completeTick: () => null, history: () => [], averages: () => new Map() },
		tickCount: 0,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

describe('MeridianTickSystem', () => {
	it('fires a tick when elapsed >= tick_interval_ms', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(500);
		expect(runner.tickCalls).toBe(1);
	});

	it('does not fire a tick when elapsed < tick_interval_ms', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(300);
		expect(runner.tickCalls).toBe(0);
	});

	it('limits catch-up to 3 ticks per update', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(5000); // 10 ticks worth, should cap at 3
		expect(runner.tickCalls).toBe(3);
	});

	it('accumulates partial elapsed time across updates', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		system.update(300);
		expect(runner.tickCalls).toBe(0);
		system.update(300); // 600 total, 1 tick fires, 100 remains
		expect(runner.tickCalls).toBe(1);
	});

	it('clamps accumulator after catch-up — limits leftover to one interval', () => {
		const runner = createMockTickRunner();
		const deps = createMockDeps();
		const system = new MeridianTickSystem(runner, deps);

		// 3000ms = 6 ticks worth at 500ms, but cap is 3 → leaves 1500ms unclamped.
		// Clamping reduces leftover to 500ms (one interval).
		system.update(3000);
		expect(runner.tickCalls).toBe(3);

		// Without clamping: accumulator=1500, update(0) → 3 more ticks (1500/500).
		// With clamping: accumulator=500, update(0) → exactly 1 tick.
		system.update(0);
		expect(runner.tickCalls).toBe(4);
	});
});
