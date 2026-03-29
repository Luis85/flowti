import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createDayNightSystem } from '../../../src/infrastructure/systems/day-night-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createWorldEntity(): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
	return actor;
}

function createDeps(eventBus = createEventBus(), tickCount = 0): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
	};
}

describe('DayNightSystem', () => {
	it('writes TimeComponent state from advanceTime', () => {
		const worldEntity = createWorldEntity();
		const system = createDayNightSystem(() => worldEntity);

		system.execute(createDeps(createEventBus(), 60));

		const time = worldEntity.get(TimeComponent);
		// tick 60 is in the 'day' phase per defaults (day: start=60, end=299)
		expect(time.state.phase).toBe('day');
		expect(time.state.tickInCycle).toBe(60);
		expect(time.state.dayCount).toBe(0);
		expect(time.dirty).toBe(true);
	});

	it('emits DayPhaseChanged event when phase transitions', () => {
		const worldEntity = createWorldEntity();
		// Manually set phase to 'dawn' so the transition to 'day' is detectable
		worldEntity.get(TimeComponent).state = { phase: 'dawn', tickInCycle: 59, dayCount: 0 };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		// tick 60 = start of 'day'; previous tick 59 = end of 'dawn' => phase change
		system.execute(createDeps(eventBus, 60));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.oldPhase).toBe('dawn');
		expect(events[0]?.payload.newPhase).toBe('day');
		expect(events[0]?.payload.dayCount).toBe(0);
	});

	it('does not emit DayPhaseChanged when phase is unchanged', () => {
		const worldEntity = createWorldEntity();
		worldEntity.get(TimeComponent).state = { phase: 'day', tickInCycle: 61, dayCount: 0 };
		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('DayPhaseChanged', (e) => { events.push(e); });

		const system = createDayNightSystem(() => worldEntity);
		// tick 62 is still 'day', so no phase change
		system.execute(createDeps(eventBus, 62));

		expect(events.length).toBe(0);
	});

	it('advances day count when cycling through a full day', () => {
		const worldEntity = createWorldEntity();
		const config = GameConfigSchema.parse({});
		const system = createDayNightSystem(() => worldEntity);

		// tick = ticks_per_day (480) means dayCount = 1
		system.execute(createDeps(createEventBus(), config.ticks_per_day));

		const time = worldEntity.get(TimeComponent);
		expect(time.state.dayCount).toBe(1);
	});
});
