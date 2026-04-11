import { describe, it, expect } from 'vitest';
import { LocationSchema } from '../../../src/domain/schemas/location-schema.js';

describe('LocationSchema facility fields', () => {
	it('accepts facility_type and active_recipe', () => {
		const result = LocationSchema.parse({
			id: 'loc-farm-1',
			name: 'Wheat Farm',
			position: { x: 100, y: 200 },
			facility_type: 'farm',
			active_recipe: 'recipe-farm-wheat',
		});
		expect(result.facility_type).toBe('farm');
		expect(result.active_recipe).toBe('recipe-farm-wheat');
	});

	it('defaults active_recipe to null when absent', () => {
		const result = LocationSchema.parse({
			id: 'loc-house-1',
			name: 'Cottage',
			position: { x: 10, y: 20 },
			facility_type: 'rest_inn',
		});
		expect(result.active_recipe).toBeNull();
	});

	it('requires facility_type', () => {
		expect(() => LocationSchema.parse({
			id: 'loc-no-type',
			name: 'No Type',
			position: { x: 0, y: 0 },
		})).toThrow();
	});
});
