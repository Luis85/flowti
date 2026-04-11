import { describe, it, expect } from 'vitest';
import { RecipeSchema } from '../../../src/domain/schemas/recipe-schema.js';

describe('RecipeSchema', () => {
	it('accepts a minimal raw producer recipe', () => {
		const parsed = RecipeSchema.parse({
			id: 'recipe-farm-wheat',
			name: 'Farm Wheat',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 15,
		});
		expect(parsed.inputs).toEqual([]);
		expect(parsed.required_skill).toBeNull();
		expect(parsed.min_skill_level).toBe(0);
	});

	it('accepts a recipe with inputs', () => {
		const parsed = RecipeSchema.parse({
			id: 'recipe-smithy-equipment',
			name: 'Forge Equipment',
			inputs: [{ item_id: 'tools', quantity: 1 }],
			outputs: [{ item_id: 'equipment', quantity: 1 }],
			ticks_per_cycle: 40,
		});
		expect(parsed.inputs).toHaveLength(1);
		expect(parsed.outputs[0]!.item_id).toBe('equipment');
	});

	it('rejects recipe id without recipe- prefix', () => {
		expect(() => RecipeSchema.parse({
			id: 'farm-wheat',
			name: 'bad',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 15,
		})).toThrow();
	});

	it('rejects empty outputs', () => {
		expect(() => RecipeSchema.parse({
			id: 'recipe-empty',
			name: 'empty',
			outputs: [],
			ticks_per_cycle: 10,
		})).toThrow();
	});

	it('rejects ticks_per_cycle < 1', () => {
		expect(() => RecipeSchema.parse({
			id: 'recipe-bad',
			name: 'bad',
			outputs: [{ item_id: 'food', quantity: 1 }],
			ticks_per_cycle: 0,
		})).toThrow();
	});
});
