import { describe, it, expect } from 'vitest';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';
import { TRAIT_CATEGORIES, TRAIT_ASSIGNABLE_BY } from '../../../src/domain/schemas/ranges.js';

describe('TraitSchema', () => {
	const validTrait = {
		id: 'trait-unkillable',
		name: 'Unkillable',
		description: 'This agent cannot die.',
		category: TRAIT_CATEGORIES[0],
		effects: [
			{ system: 'MortalityCheck', modifier: { prevent_death: true } },
		],
		assignable_by: TRAIT_ASSIGNABLE_BY[0],
		stackable: false,
		conflicts_with: [],
	};

	it('validates a well-formed trait', () => {
		expect(TraitSchema.safeParse(validTrait).success).toBe(true);
	});

	it('rejects invalid category', () => {
		expect(TraitSchema.safeParse({ ...validTrait, category: 'invalid' }).success).toBe(false);
	});

	it('rejects invalid id prefix', () => {
		expect(TraitSchema.safeParse({ ...validTrait, id: 'bonus-speed' }).success).toBe(false);
	});

	it('validates all assignable_by values', () => {
		for (const by of TRAIT_ASSIGNABLE_BY) {
			expect(TraitSchema.safeParse({ ...validTrait, assignable_by: by }).success).toBe(true);
		}
	});

	it('validates all category values', () => {
		for (const cat of TRAIT_CATEGORIES) {
			expect(TraitSchema.safeParse({ ...validTrait, category: cat }).success).toBe(true);
		}
	});

	it('applies defaults for stackable and conflicts_with', () => {
		const { stackable: _, conflicts_with: __, ...minimal } = validTrait;
		const result = TraitSchema.parse(minimal);
		expect(result.stackable).toBe(false);
		expect(result.conflicts_with).toEqual([]);
	});
});
