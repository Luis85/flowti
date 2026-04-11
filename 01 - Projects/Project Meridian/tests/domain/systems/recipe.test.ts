import { describe, it, expect } from 'vitest';
import { applyRecipeCycle } from '../../../src/domain/systems/recipe.js';
import type {
	RecipeCycleInput,
	StockEntry,
} from '../../../src/domain/systems/recipe.js';
import type { Recipe } from '../../../src/domain/schemas/recipe-schema.js';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
	return {
		id: 'recipe-bread',
		name: 'Bread',
		inputs: [{ item_id: 'item-flour', quantity: 2 }],
		outputs: [{ item_id: 'item-bread', quantity: 1 }],
		ticks_per_cycle: 5,
		required_skill: null,
		min_skill_level: 0,
		...overrides,
	};
}

function baseInput(overrides: Partial<RecipeCycleInput> = {}): RecipeCycleInput {
	return {
		facilityStock: [{ item_id: 'item-flour', quantity: 10 }],
		workProgress: 0,
		ticksPerCycle: 5,
		recipe: makeRecipe(),
		wage: 3,
		facilityFund: 100,
		funding: 'facility' as const,
		treasuryFund: 0,
		taxRate: 0.05,
		...overrides,
	};
}

describe('applyRecipeCycle', () => {
	describe('raw producer (no inputs)', () => {
		it('increments workProgress each tick and completes a cycle on the Nth call', () => {
			const recipe = makeRecipe({
				id: 'recipe-logs',
				name: 'Chop logs',
				inputs: [],
				outputs: [{ item_id: 'item-log', quantity: 1 }],
				ticks_per_cycle: 3,
			});
			let state: RecipeCycleInput = baseInput({
				recipe,
				facilityStock: [],
				ticksPerCycle: 3,
			});

			// tick 1 — progress -> 1
			let result = applyRecipeCycle(state);
			expect(result.cycleComplete).toBe(false);
			expect(result.newWorkProgress).toBe(1);
			expect(result.newStock).toEqual([]);
			expect(result.workerGoldChange).toBe(0);
			expect(result.taxCollected).toBe(0);
			expect(result.newFund).toBe(100);
			state = { ...state, workProgress: result.newWorkProgress, facilityStock: result.newStock };

			// tick 2 — progress -> 2
			result = applyRecipeCycle(state);
			expect(result.cycleComplete).toBe(false);
			expect(result.newWorkProgress).toBe(2);
			state = { ...state, workProgress: result.newWorkProgress, facilityStock: result.newStock };

			// tick 3 — cycle complete, output added, wage paid
			result = applyRecipeCycle(state);
			expect(result.cycleComplete).toBe(true);
			expect(result.newWorkProgress).toBe(0);
			expect(result.newStock).toEqual([{ item_id: 'item-log', quantity: 1 }]);
			// Wage 3, tax 5% -> net 2.85
			expect(result.workerGoldChange).toBeCloseTo(2.85, 5);
			expect(result.taxCollected).toBeCloseTo(0.15, 5);
			expect(result.newFund).toBe(97);
		});
	});

	describe('recipe with matching inputs', () => {
		it('consumes inputs exactly once and adds output on cycle complete', () => {
			const input = baseInput({
				workProgress: 4, // nextProgress = 5 = ticksPerCycle
				facilityStock: [
					{ item_id: 'item-flour', quantity: 5 },
					{ item_id: 'item-salt', quantity: 2 },
				],
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.newWorkProgress).toBe(0);
			// flour 5 -> 3, salt untouched, bread +1
			expect(result.newStock).toEqual([
				{ item_id: 'item-flour', quantity: 3 },
				{ item_id: 'item-salt', quantity: 2 },
				{ item_id: 'item-bread', quantity: 1 },
			]);
		});

		it('removes stock entries that drop to zero after consumption', () => {
			const input = baseInput({
				workProgress: 4,
				facilityStock: [{ item_id: 'item-flour', quantity: 2 }],
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			// flour fully consumed, only bread remains
			expect(result.newStock).toEqual([{ item_id: 'item-bread', quantity: 1 }]);
		});

		it('increments existing output entry rather than duplicating', () => {
			const input = baseInput({
				workProgress: 4,
				facilityStock: [
					{ item_id: 'item-flour', quantity: 5 },
					{ item_id: 'item-bread', quantity: 4 },
				],
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.newStock).toEqual([
				{ item_id: 'item-flour', quantity: 3 },
				{ item_id: 'item-bread', quantity: 5 },
			]);
		});

		it('does not mutate input arrays', () => {
			const stock: StockEntry[] = [{ item_id: 'item-flour', quantity: 5 }];
			const frozenStock = Object.freeze([...stock]);
			const input = baseInput({
				workProgress: 4,
				facilityStock: frozenStock,
			});
			expect(() => applyRecipeCycle(input)).not.toThrow();
			expect(stock).toEqual([{ item_id: 'item-flour', quantity: 5 }]);
		});
	});

	describe('missing inputs', () => {
		it('returns unchanged state when stock lacks a required input entirely', () => {
			const input = baseInput({
				workProgress: 2,
				facilityStock: [],
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(false);
			expect(result.newWorkProgress).toBe(2);
			expect(result.newStock).toEqual([]);
			expect(result.newFund).toBe(100);
			expect(result.newTreasury).toBe(0);
			expect(result.workerGoldChange).toBe(0);
			expect(result.taxCollected).toBe(0);
		});

		it('returns unchanged state when stock has insufficient quantity', () => {
			const input = baseInput({
				workProgress: 2,
				facilityStock: [{ item_id: 'item-flour', quantity: 1 }], // need 2
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(false);
			expect(result.newWorkProgress).toBe(2);
			expect(result.newStock).toEqual([{ item_id: 'item-flour', quantity: 1 }]);
			expect(result.newFund).toBe(100);
		});
	});

	describe('tax calculation (facility funding)', () => {
		it('drains full wage from fund and routes tax to taxCollected', () => {
			const input = baseInput({
				workProgress: 4,
				wage: 10,
				taxRate: 0.2,
				facilityFund: 50,
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.workerGoldChange).toBeCloseTo(8, 5); // 10 - 2
			expect(result.taxCollected).toBeCloseTo(2, 5);
			expect(result.newFund).toBe(40); // 50 - 10
			expect(result.newTreasury).toBe(0);
		});
	});

	describe("funding === 'treasury'", () => {
		it('drains treasury, leaves fund unchanged, no tax collected', () => {
			const input = baseInput({
				workProgress: 4,
				wage: 5,
				taxRate: 0.1,
				facilityFund: 100,
				funding: 'treasury',
				treasuryFund: 200,
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.workerGoldChange).toBe(5);
			expect(result.taxCollected).toBe(0);
			expect(result.newFund).toBe(100); // unchanged
			expect(result.newTreasury).toBe(195);
		});
	});

	describe('wage exceeds available funds', () => {
		it('pays partial wage from facility fund when wage > fund', () => {
			const input = baseInput({
				workProgress: 4,
				wage: 10,
				taxRate: 0.1,
				facilityFund: 4,
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			// actualWage = min(10, 4) = 4; tax = 0.4; net = 3.6
			expect(result.workerGoldChange).toBeCloseTo(3.6, 5);
			expect(result.taxCollected).toBeCloseTo(0.4, 5);
			expect(result.newFund).toBe(0);
		});

		it('pays partial wage from treasury when wage > treasury', () => {
			const input = baseInput({
				workProgress: 4,
				wage: 10,
				funding: 'treasury',
				treasuryFund: 3,
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.workerGoldChange).toBe(3);
			expect(result.taxCollected).toBe(0);
			expect(result.newTreasury).toBe(0);
			expect(result.newFund).toBe(100); // unchanged
		});
	});

	describe('multi-output recipes', () => {
		it('adds all outputs to stock on cycle complete', () => {
			const recipe = makeRecipe({
				id: 'recipe-butcher',
				outputs: [
					{ item_id: 'item-meat', quantity: 2 },
					{ item_id: 'item-hide', quantity: 1 },
				],
				inputs: [],
			});
			const input = baseInput({
				recipe,
				workProgress: 4,
				facilityStock: [],
			});
			const result = applyRecipeCycle(input);
			expect(result.cycleComplete).toBe(true);
			expect(result.newStock).toEqual([
				{ item_id: 'item-meat', quantity: 2 },
				{ item_id: 'item-hide', quantity: 1 },
			]);
		});
	});
});
