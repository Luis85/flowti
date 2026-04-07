import { describe, it, expect } from 'vitest';
import { findNearest, updateItemInInventory } from '../../../src/domain/core/array-utils.js';

describe('findNearest', () => {
	it('returns null for empty array', () => {
		expect(findNearest([])).toBeNull();
	});

	it('returns the only item', () => {
		const items = [{ id: 'a', distance: 5 }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 5 });
	});

	it('returns closest of multiple items', () => {
		const items = [
			{ id: 'far', distance: 100 },
			{ id: 'near', distance: 3 },
			{ id: 'mid', distance: 50 },
		];
		expect(findNearest(items)?.id).toBe('near');
	});

	it('preserves all properties on returned item', () => {
		const items = [{ id: 'a', distance: 1, extra: 'data' }];
		expect(findNearest(items)).toEqual({ id: 'a', distance: 1, extra: 'data' });
	});
});

describe('updateItemInInventory', () => {
	const items = [
		{ item_id: 'bread', quantity: 3, charges: undefined },
		{ item_id: 'sword', quantity: 1, charges: 5 },
	];

	it('updates matching item without mutating original', () => {
		const result = updateItemInInventory(items, 'bread', { quantity: 10 });
		expect(result.find(i => i.item_id === 'bread')?.quantity).toBe(10);
		expect(items[0].quantity).toBe(3); // original unchanged
	});

	it('leaves non-matching items unchanged', () => {
		const result = updateItemInInventory(items, 'bread', { quantity: 10 });
		expect(result.find(i => i.item_id === 'sword')).toEqual({ item_id: 'sword', quantity: 1, charges: 5 });
	});

	it('returns copy when no item matches', () => {
		const result = updateItemInInventory(items, 'potion', { quantity: 1 });
		expect(result).toEqual(items);
		expect(result).not.toBe(items);
	});
});
