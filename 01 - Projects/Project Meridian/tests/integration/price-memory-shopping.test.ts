import { describe, it, expect } from 'vitest';
import { CircularBuffer } from 'mnemonist';
import { isPriceStale, getBestKnownSource, getRememberedPrice, type PriceMemory } from '../../src/domain/systems/price-memory.js';
import { FOOD_ITEMS } from '../../src/domain/systems/food-items.js';

describe('Price memory shopping integration', () => {
	it('agent with two memories targets cheapest source', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		memories.push({ itemId: 'food', price: 8, locationId: 'loc-bakery', tick: 100 });
		memories.push({ itemId: 'food', price: 4, locationId: 'loc-market', tick: 110 });

		const staleTicks = 200;
		const currentTick = 150;

		// Find cheapest known bread source
		let cheapestLoc: string | null = null;
		let cheapestPrice = Infinity;
		for (const foodId of FOOD_ITEMS) {
			const loc = getBestKnownSource(memories, foodId, currentTick, staleTicks);
			if (loc === null) continue;
			const mem = getRememberedPrice(memories, foodId, currentTick, staleTicks);
			if (mem !== null && mem.price < cheapestPrice) {
				cheapestPrice = mem.price;
				cheapestLoc = loc;
			}
		}

		expect(cheapestLoc).toBe('loc-market');
		expect(cheapestPrice).toBe(4);
	});

	it('agent with only stale memories returns null', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		memories.push({ itemId: 'food', price: 5, locationId: 'loc-bakery', tick: 10 });

		const staleTicks = 200;
		const currentTick = 300;

		let found = false;
		for (const foodId of FOOD_ITEMS) {
			const loc = getBestKnownSource(memories, foodId, currentTick, staleTicks);
			if (loc !== null) found = true;
		}
		expect(found).toBe(false);
	});

	it('agent with empty memories returns null', () => {
		const memories = new CircularBuffer<PriceMemory>(Array, 20);
		const loc = getBestKnownSource(memories, 'food', 100, 200);
		expect(loc).toBeNull();
	});
});
