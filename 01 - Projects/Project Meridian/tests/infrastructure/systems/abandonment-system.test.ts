import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createAbandonmentSystem } from '../../../src/infrastructure/systems/abandonment-system.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { GameEvent } from '../../../src/domain/core/events.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';

function createDeps(eventBus = createEventBus(), tickCount = 1): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus,
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
	};
}

function createFacilityActor(fund: number, status: 'idle' | 'producing' | 'auto' | 'abandoned' = 'idle', workerId: string | null = null): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock: [],
		fund,
		workProgress: 0,
		status,
		workerId,
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

describe('AbandonmentSystem', () => {
	it('sets status to abandoned when fund <= 0 and no worker', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(0);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.status).toBe('abandoned');
	});

	it('emits FacilityAbandoned event with facilityId', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(0);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityAbandoned', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.facilityId).toBe('loc-bakery');
		expect(events[0]?.payload.lastWorker).toBeNull();
	});

	it('abandons and evicts worker when fund=0 (worker present)', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(0, 'idle', 'agent-bob');
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityAbandoned', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.lastWorker).toBe('agent-bob');
		expect(locActor.get(FacilityComponent).state.status).toBe('abandoned');
	});

	it('does not abandon if fund > 0', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(50);
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityAbandoned', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(locActor.get(FacilityComponent).state.status).toBe('idle');
	});

	it('restores facility when fund > 0 and status is abandoned', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(100, 'abandoned');
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		system.execute(createDeps());

		expect(locActor.get(FacilityComponent).state.status).toBe('idle');
	});

	it('emits FacilityRestored event', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(100, 'abandoned');
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityRestored', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(1);
		expect(events[0]?.payload.facilityId).toBe('loc-bakery');
		expect(events[0]?.payload.newFund).toBe(100);
	});

	it('does not re-abandon already abandoned facility', () => {
		const loc = createLocation('loc-bakery');
		const locActor = createFacilityActor(0, 'abandoned');
		const locationActors = new Map<string, Actor>([['loc-bakery', locActor]]);
		const system = createAbandonmentSystem(() => locationActors, () => [loc]);

		const eventBus = createEventBus();
		const events: GameEvent[] = [];
		eventBus.on('FacilityAbandoned', (e) => { events.push(e); });

		system.execute(createDeps(eventBus));

		expect(events.length).toBe(0);
		expect(locActor.get(FacilityComponent).state.status).toBe('abandoned');
	});

	it('has correct system name and priority', () => {
		const system = createAbandonmentSystem(() => new Map(), () => []);
		expect(system.name).toBe('AbandonmentSystem');
		expect(system.priority).toBe(18.8);
	});
});
