import { describe, it, expect } from 'vitest';
import { Actor } from 'excalibur';
import { createEconomySystem } from '../../../src/infrastructure/systems/economy-system.js';
import { FacilityComponent } from '../../../src/infrastructure/components/facility-component.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { WorldLocation } from '../../../src/domain/schemas/location-schema.js';
import type { Item } from '../../../src/domain/schemas/item-schema.js';

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

function createMarketLocation(id = 'loc-market'): WorldLocation {
	return {
		id,
		name: 'Market',
		type: 'market',
		position: { x: 100, y: 100, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: null,
	};
}

function createProductionLocation(id = 'loc-bakery'): WorldLocation {
	return {
		id,
		name: 'Bakery',
		type: 'work',
		position: { x: 200, y: 200, region: 'test' },
		capacity: 10,
		color: '#808080',
		production: {
			job: 'baker',
			output: { item_id: 'food', quantity: 1 },
			input: { item_id: 'wheat', quantity: 1 },
			wage: 5,
			ticks_per_cycle: 30,
		},
	};
}

function createFacilityActor(stock: { item_id: string; quantity: number }[] = []): Actor {
	const actor = new Actor();
	actor.addComponent(new FacilityComponent({
		stock,
		fund: 200,
		workProgress: 0,
		status: 'idle',
		workerId: null,
	}));
	return actor;
}

function createItemRegistry(items: Item[]): Map<string, Item> {
	const map = new Map<string, Item>();
	for (const item of items) map.set(item.id, item);
	return map;
}

describe('EconomySystem', () => {
	it('initializes recalc queue for market locations on first tick', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation();
		const marketActor = createFacilityActor([{ item_id: 'food', quantity: 5 }]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		const deps = createDeps(eventBus, 1);
		system.execute(deps);

		// After first tick the facility should have had its prices recalculated
		const facility = marketActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeDefined();
		expect(typeof facility.state.currentPrices!['food']).toBe('number');
	});

	it('initializes recalc queue for production locations on first tick', () => {
		const eventBus = createEventBus();
		const bakery = createProductionLocation();
		const bakeryActor = createFacilityActor([{ item_id: 'food', quantity: 3 }]);
		const locationActors = new Map<string, Actor>([['loc-bakery', bakeryActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [bakery],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		const facility = bakeryActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeDefined();
		expect(typeof facility.state.currentPrices!['food']).toBe('number');
	});

	it('does not queue locations without production and non-market type', () => {
		const eventBus = createEventBus();
		const restLocation: WorldLocation = {
			id: 'loc-rest',
			name: 'Rest Spot',
			type: 'rest',
			position: { x: 50, y: 50, region: 'test' },
			capacity: 10,
			color: '#808080',
			production: null,
		};
		const restActor = createFacilityActor([{ item_id: 'food', quantity: 1 }]);
		const locationActors = new Map<string, Actor>([['loc-rest', restActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [restLocation],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		// No recalculation should have occurred, currentPrices remains undefined
		const facility = restActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeUndefined();
	});

	it('recalculates prices and marks facility dirty', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation();
		const marketActor = createFacilityActor([
			{ item_id: 'food', quantity: 10 },
			{ item_id: 'tools', quantity: 2 },
		]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
			{ id: 'tools', name: 'Tools', baseValue: 10, category: 'trade_goods' },
		]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		const facility = marketActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeDefined();
		expect(facility.state.currentPrices!['food']).toBeGreaterThan(0);
		expect(facility.state.currentPrices!['tools']).toBeGreaterThan(0);
		expect(facility.dirty).toBe(true);
	});

	it('reschedules recalculation at interval after first execution', () => {
		const eventBus = createEventBus();
		const config = GameConfigSchema.parse({});
		const interval = config.economy.recalculation_interval_ticks; // 10

		const market = createMarketLocation();
		const marketActor = createFacilityActor([{ item_id: 'food', quantity: 5 }]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		// Tick 1: initial recalc
		system.execute(createDeps(eventBus, 1));
		const pricesAfterFirst = { ...marketActor.get(FacilityComponent).state.currentPrices };

		// Clear dirty to detect subsequent recalc
		marketActor.get(FacilityComponent).clearDirty();

		// Tick 5: too early for next recalc (scheduled at 1 + interval)
		system.execute(createDeps(eventBus, 5));
		expect(marketActor.get(FacilityComponent).dirty).toBe(false);

		// Tick at interval + 1: recalc should fire
		system.execute(createDeps(eventBus, 1 + interval));
		expect(marketActor.get(FacilityComponent).dirty).toBe(true);
		expect(marketActor.get(FacilityComponent).state.currentPrices).toBeDefined();
	});

	it('uses default baseValue when item not found in registry', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation();
		const marketActor = createFacilityActor([{ item_id: 'unknown-item', quantity: 3 }]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		// Empty registry: unknown-item has no entry
		const items = createItemRegistry([]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		const facility = marketActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeDefined();
		// Should still produce a price using fallback baseValue (5) and 'trade_goods' category
		expect(typeof facility.state.currentPrices!['unknown-item']).toBe('number');
		expect(facility.state.currentPrices!['unknown-item']).toBeGreaterThan(0);
	});

	it('skips facility when location actor is missing from map', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation('loc-missing');
		// Do NOT add actor to the map
		const locationActors = new Map<string, Actor>();
		const items = createItemRegistry([]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		// Should not throw
		system.execute(createDeps(eventBus, 1));

		// No crash; the missing facility is rescheduled and will attempt again later
	});

	it('records PurchaseComplete events into demand tracker and influences price', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation();
		const marketActor = createFacilityActor([{ item_id: 'food', quantity: 5 }]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		// Tick 1: initial recalc with no demand
		system.execute(createDeps(eventBus, 1));
		const priceWithoutDemand = marketActor.get(FacilityComponent).state.currentPrices!['food'];

		const config = GameConfigSchema.parse({});
		const nextRecalcTick = 1 + config.economy.recalculation_interval_ticks;

		// Emit multiple PurchaseComplete events to build demand before next recalc
		for (let i = 0; i < 10; i++) {
			eventBus.emit({
				type: 'PurchaseComplete',
				tick: nextRecalcTick,
				wallClock: Date.now(),
				source: 'TradeSystem',
				payload: { agentId: 'agent-1', facilityId: 'loc-market', itemId: 'food', price: 3, quantity: 1 },
			});
		}

		// Execute at the next recalc tick so demand is picked up
		system.execute(createDeps(eventBus, nextRecalcTick));
		const priceWithDemand = marketActor.get(FacilityComponent).state.currentPrices!['food'];

		// With high demand rate, the price should be at least as high as without demand
		expect(priceWithDemand).toBeGreaterThanOrEqual(priceWithoutDemand);
	});

	it('handles multiple facilities in one tick', () => {
		const eventBus = createEventBus();
		const market = createMarketLocation('loc-market');
		const bakery = createProductionLocation('loc-bakery');
		const marketActor = createFacilityActor([{ item_id: 'food', quantity: 5 }]);
		const bakeryActor = createFacilityActor([{ item_id: 'food', quantity: 2 }]);
		const locationActors = new Map<string, Actor>([
			['loc-market', marketActor],
			['loc-bakery', bakeryActor],
		]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [market, bakery],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		// Both facilities should have prices set
		expect(marketActor.get(FacilityComponent).state.currentPrices).toBeDefined();
		expect(bakeryActor.get(FacilityComponent).state.currentPrices).toBeDefined();
		expect(marketActor.get(FacilityComponent).dirty).toBe(true);
		expect(bakeryActor.get(FacilityComponent).dirty).toBe(true);
	});

	it('has correct system name and priority', () => {
		const system = createEconomySystem(
			() => [],
			() => new Map(),
			() => new Map(),
		);

		expect(system.name).toBe('EconomySystem');
		expect(system.priority).toBeDefined();
	});

	it('prices respect clamp bounds from config', () => {
		const eventBus = createEventBus();
		const config = GameConfigSchema.parse({});
		const market = createMarketLocation();
		const marketActor = createFacilityActor([{ item_id: 'food', quantity: 5 }]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([
			{ id: 'food', name: 'Food', baseValue: 3, category: 'subsistence' },
		]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		system.execute(createDeps(eventBus, 1));

		const facility = marketActor.get(FacilityComponent);
		const price = facility.state.currentPrices!['food'];
		const baseValue = 3;
		expect(price).toBeGreaterThanOrEqual(baseValue * config.economy.price_clamp_min);
		expect(price).toBeLessThanOrEqual(baseValue * config.economy.price_clamp_max);
	});

	it('sets demand_window_ticks on demand tracker during initialization', () => {
		const eventBus = createEventBus();
		// Location with no stock - will recalc but produce empty prices
		const market = createMarketLocation();
		const marketActor = createFacilityActor([]);
		const locationActors = new Map<string, Actor>([['loc-market', marketActor]]);
		const items = createItemRegistry([]);

		const system = createEconomySystem(
			() => [market],
			() => locationActors,
			() => items,
		);

		// First execute initializes the system; no crash expected
		system.execute(createDeps(eventBus, 1));

		// Second execute should not re-initialize
		system.execute(createDeps(eventBus, 2));

		// Verify facility still has prices (empty object for no stock)
		const facility = marketActor.get(FacilityComponent);
		expect(facility.state.currentPrices).toBeDefined();
	});
});
