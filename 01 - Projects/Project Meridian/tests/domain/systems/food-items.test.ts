import { describe, it, expect } from 'vitest';
import { FOOD_ITEMS, findFoodInInventory, removeFromInventory } from '../../../src/domain/systems/food-items.js';
import type { InventoryItem } from '../../../src/domain/systems/food-items.js';

describe('FOOD_ITEMS', () => {
	it('contains food', () => {
		expect(FOOD_ITEMS.has('food')).toBe(true);
	});

	it('does not contain raw materials', () => {
		expect(FOOD_ITEMS.has('wheat')).toBe(false);
		expect(FOOD_ITEMS.has('flour')).toBe(false);
		expect(FOOD_ITEMS.has('wood')).toBe(false);
	});
});

describe('findFoodInInventory', () => {
	it('finds food', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'wheat', quantity: 5 },
			{ item_id: 'food', quantity: 3 },
		];
		const result = findFoodInInventory(inventory);
		expect(result).toEqual({ item_id: 'food', quantity: 3 });
	});

	it('returns null when no food', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'wheat', quantity: 5 },
			{ item_id: 'wood', quantity: 10 },
		];
		expect(findFoodInInventory(inventory)).toBeNull();
	});

	it('returns null for empty inventory', () => {
		expect(findFoodInInventory([])).toBeNull();
	});
});

describe('removeFromInventory', () => {
	it('decrements quantity', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'food', quantity: 5 },
			{ item_id: 'wheat', quantity: 3 },
		];
		const result = removeFromInventory(inventory, 'food', 2);
		expect(result).toEqual([
			{ item_id: 'food', quantity: 3 },
			{ item_id: 'wheat', quantity: 3 },
		]);
	});

	it('removes item when quantity reaches zero', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'food', quantity: 2 },
			{ item_id: 'wheat', quantity: 3 },
		];
		const result = removeFromInventory(inventory, 'food', 2);
		expect(result).toEqual([{ item_id: 'wheat', quantity: 3 }]);
	});

	it('returns unchanged copy when item not found', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'food', quantity: 5 },
		];
		const result = removeFromInventory(inventory, 'gold_bar', 1);
		expect(result).toEqual([{ item_id: 'food', quantity: 5 }]);
	});

	it('removes item when amount exceeds quantity', () => {
		const inventory: InventoryItem[] = [
			{ item_id: 'food', quantity: 1 },
			{ item_id: 'wheat', quantity: 3 },
		];
		const result = removeFromInventory(inventory, 'food', 5);
		expect(result).toEqual([{ item_id: 'wheat', quantity: 3 }]);
	});

	it('does not mutate original array', () => {
		const original: InventoryItem[] = [
			{ item_id: 'food', quantity: 5 },
		];
		const originalCopy = JSON.parse(JSON.stringify(original)) as InventoryItem[];
		removeFromInventory(original, 'food', 2);
		expect(original).toEqual(originalCopy);
	});
});
