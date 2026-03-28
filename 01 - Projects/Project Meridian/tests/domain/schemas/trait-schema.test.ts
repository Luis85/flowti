import { describe, it, expect } from 'vitest';
import { TraitSchema } from '../../../src/domain/schemas/trait-schema.js';

describe('TraitSchema', () => {
	const validTrait = {
		id: 'trait-unkillable',
		name: 'Unkillable',
		description: 'This agent cannot die.',
		category: 'survival',
		effects: [
			{ system: 'MortalityCheck', modifier: { prevent_death: true, auto_recover_ticks: 150 } },
		],
		assignable_by: 'director',
		stackable: false,
		conflicts_with: [],
	};

	it('validates a well-formed trait', () => {
		const result = TraitSchema.safeParse(validTrait);
		expect(result.success).toBe(true);
	});

	it('rejects invalid category', () => {
		const result = TraitSchema.safeParse({ ...validTrait, category: 'invalid' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid id prefix', () => {
		const result = TraitSchema.safeParse({ ...validTrait, id: 'bonus-speed' });
		expect(result.success).toBe(false);
	});

	it('validates all assignable_by values', () => {
		for (const by of ['director', 'definition', 'milestone', 'inherited']) {
			const result = TraitSchema.safeParse({ ...validTrait, assignable_by: by });
			expect(result.success).toBe(true);
		}
	});
});
