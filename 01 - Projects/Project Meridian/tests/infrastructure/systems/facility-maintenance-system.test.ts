import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createFacilityMaintenanceSystem } from '../../../src/infrastructure/systems/facility-maintenance-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';

function createWorldEntity(dayBoundary: boolean): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	return actor;
}

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

function createFacilityActor(fund: number, status: 'idle' | 'producing' | 'auto' | 'abandoned' = 'idle'): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock: [],
		fund,
		workProgress: 0,
		status,
		workerId: null,
	}));
	return actor;
}

describe('FacilityMaintenanceSystem', () => {
	it('deducts maintenance cost from active facility on day boundary', () => {
		const worldEntity = createWorldEntity(true);
		const locActor = createFacilityActor(100);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.fund).toBe(95);
	});

	it('skips abandoned facilities', () => {
		const worldEntity = createWorldEntity(true);
		const locActor = createFacilityActor(100, 'abandoned');
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.fund).toBe(100);
	});

	it('skips facilities at or below minimum fund threshold (10g)', () => {
		const worldEntity = createWorldEntity(true);
		const locActor = createFacilityActor(10);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.fund).toBe(10);
	});

	it('does not drain below minimum fund threshold', () => {
		const worldEntity = createWorldEntity(true);
		const locActor = createFacilityActor(12);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.fund).toBe(10);
	});

	it('does nothing when not day boundary', () => {
		const worldEntity = createWorldEntity(false);
		const locActor = createFacilityActor(100);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.fund).toBe(100);
	});

	it('emits GoldFlowed event with sink category', () => {
		const worldEntity = createWorldEntity(true);
		const locActor = createFacilityActor(100);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createFacilityMaintenanceSystem(() => worldEntity, () => locationActors);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('GoldFlowed', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.category).toBe('sink');
		expect(events[0]?.payload.subcategory).toBe('facility_maintenance');
		expect(events[0]?.payload.amount).toBe(5);
		expect(events[0]?.payload.fromEntity).toBe('loc-bakery');
		expect(events[0]?.payload.toEntity).toBeNull();
	});
});
