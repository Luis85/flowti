import { describe, it, expect } from 'vitest';
import { ProductionSchema } from '../../../src/domain/schemas/location-schema.js';

describe('ProductionSchema', () => {
	it('ProductionSchema accepts funding field with facility default', () => {
		const result = ProductionSchema.parse({
			job: 'farmer', output: { item_id: 'food', quantity: 1 },
			wage: 3, ticks_per_cycle: 15,
		});
		expect(result!.funding).toBe('facility');
	});

	it('ProductionSchema accepts treasury funding', () => {
		const result = ProductionSchema.parse({
			job: 'guard', output: { item_id: 'security', quantity: 1 },
			wage: 4, ticks_per_cycle: 20, funding: 'treasury',
		});
		expect(result!.funding).toBe('treasury');
	});
});
