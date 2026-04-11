import { describe, it, expect } from 'vitest';
import { LocationSchema, ProductionSchema } from '../../../src/domain/schemas/location-schema.js';

describe('LocationSchema facility fields', () => {
	it('accepts facility_type and active_recipe', () => {
		const result = LocationSchema.parse({
			id: 'loc-farm-1',
			name: 'Wheat Farm',
			type: 'work',
			position: { x: 100, y: 200 },
			production: null,
			leisure: null,
			facility_type: 'farm',
			active_recipe: 'recipe-farm-wheat',
		});
		expect(result.facility_type).toBe('farm');
		expect(result.active_recipe).toBe('recipe-farm-wheat');
	});
});

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
