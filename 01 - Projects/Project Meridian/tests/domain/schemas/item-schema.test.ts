import { describe, it, expect } from 'vitest';
import { ItemSchema } from '../../../src/domain/schemas/item-schema.js';

describe('ItemSchema', () => {
	it('accepts a valid item with explicit category', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: 5,
			category: 'subsistence',
		});
		expect(result.success).toBe(true);
	});

	it('defaults category to trade_goods', () => {
		const result = ItemSchema.safeParse({
			id: 'leather',
			name: 'Leather',
			baseValue: 8,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.category).toBe('trade_goods');
		}
	});

	it('rejects invalid category', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: 5,
			category: 'mythical',
		});
		expect(result.success).toBe(false);
	});

	it('rejects negative baseValue', () => {
		const result = ItemSchema.safeParse({
			id: 'bread',
			name: 'Bread',
			baseValue: -1,
			category: 'subsistence',
		});
		expect(result.success).toBe(false);
	});

	it('accepts all four valid categories', () => {
		for (const cat of ['subsistence', 'comfort', 'trade_goods', 'luxury']) {
			const result = ItemSchema.safeParse({
				id: `test-${cat}`,
				name: `Test ${cat}`,
				baseValue: 10,
				category: cat,
			});
			expect(result.success, `category '${cat}' should be valid`).toBe(true);
		}
	});
});
