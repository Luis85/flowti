import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createSubsidySystem } from '../../../src/infrastructure/systems/subsidy-system.js';
import { TimeComponent } from '../../../src/infrastructure/components/time-component.js';
import { EconomyComponent } from '../../../src/infrastructure/components/economy-component.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

function createWorldEntity(dayBoundary: boolean, treasury = 1000): Actor {
	const actor = new Actor();
	actor.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 1, dayBoundaryThisTick: dayBoundary }));
	actor.addComponent(new EconomyComponent({
		treasury,
		ledger: [],
		dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
	}));
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
	};
}

function createFacilityActor(fund: number): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock: [],
		fund,
		workProgress: 0,
		status: 'idle',
		workerId: null,
	}));
	return actor;
}

function createLocation(id: string): WorldLocation {
	return {
		id,
		name: `Location ${id}`,
		type: 'work',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: null,
	};
}

describe('SubsidySystem', () => {
	it('skips when dayBoundaryThisTick is false', () => {
		const worldEntity = createWorldEntity(false);
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(10);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilitySubsidised', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(locActor.get(FacilityComponent).state.fund).toBe(10);
	});

	it('subsidises facility below threshold', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const loc = createLocation('loc-bakery');
		const fundBelow = config.economy.facility_subsidy_threshold - 10;
		const locActor = createFacilityActor(fundBelow);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const subsidyEvents: GameEvent[] = [];
		const goldEvents: GameEvent[] = [];
		eventBus.on('FacilitySubsidised', (e) => { subsidyEvents.push(e); });
		eventBus.on('GoldFlowed', (e) => { goldEvents.push(e); });

		system.execute(createDeps(eventBus));

		expect(subsidyEvents.length).toBe(1);
		expect(subsidyEvents[0]?.payload.facilityId).toBe('loc-bakery');
		expect(subsidyEvents[0]?.payload.amount).toBe(config.economy.facility_subsidy_per_day);
		expect(locActor.get(FacilityComponent).state.fund).toBe(fundBelow + config.economy.facility_subsidy_per_day);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(1000 - config.economy.facility_subsidy_per_day);

		expect(goldEvents.length).toBe(1);
		expect(goldEvents[0]?.payload.category).toBe('transfer');
		expect(goldEvents[0]?.payload.subcategory).toBe('subsidy');
	});

	it('does not subsidise facility at or above threshold', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 1000);
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(config.economy.facility_subsidy_threshold);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilitySubsidised', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(locActor.get(FacilityComponent).state.fund).toBe(config.economy.facility_subsidy_threshold);
		expect(worldEntity.get(EconomyComponent).state.treasury).toBe(1000);
	});

	it('skips when treasury insufficient', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, config.economy.facility_subsidy_per_day - 1);
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(10);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilitySubsidised', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(locActor.get(FacilityComponent).state.fund).toBe(10);
	});

	it('has correct system name and priority', () => {
		const system = createSubsidySystem(() => new Actor(), () => new Map(), () => []);
		expect(system.name).toBe('SubsidySystem');
		expect(system.priority).toBe(0.82);
	});

	it('adds ledger entries for each subsidy', () => {
		const config = GameConfigSchema.parse({});
		const worldEntity = createWorldEntity(true, 5000);
		const loc1 = createLocation('loc-bakery');
		const loc2 = createLocation('loc-smithy');
		const locActor1 = createFacilityActor(10);
		const locActor2 = createFacilityActor(20);
		const locationActors = new Map<string, Actor>([
			['loc-bakery', locActor1],
			['loc-smithy', locActor2],
		]);
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc1, loc2]);

		system.execute(createDeps(createEventBus()));

		const economy = worldEntity.get(EconomyComponent);
		expect(economy.state.ledger.length).toBe(2);
		expect(economy.state.ledger[0]?.type).toBe('subsidy');
		expect(economy.state.ledger[0]?.to).toBe('loc-bakery');
		expect(economy.state.ledger[1]?.to).toBe('loc-smithy');
	});

	it('skips location actors not in the map', () => {
		const worldEntity = createWorldEntity(true, 1000);
		const loc = createLocation('loc-missing');
		const locationActors = new Map<string, Actor>();
		const system = createSubsidySystem(() => worldEntity, () => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilitySubsidised', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
	});
});
