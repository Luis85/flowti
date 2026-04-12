import { describe, it, expect } from 'vitest';
import { FacilityTypeSchema } from '../../../src/domain/schemas/facility-type-schema.js';

describe('FacilityTypeSchema', () => {
	describe('production kind', () => {
		it('parses minimal production facility with defaults', () => {
			const parsed = FacilityTypeSchema.parse({
				id: 'farm',
				kind: 'production',
				primary_job: 'settler',
				allowed_recipes: ['recipe-farm-wheat'],
			});
			expect(parsed.kind).toBe('production');
			expect(parsed.id).toBe('farm');
			expect(parsed.primary_job).toBe('settler');
			expect(parsed.default_wage).toBe(3);
			expect(parsed.default_fund).toBe(200);
			expect(parsed.funding).toBe('facility');
			expect(parsed.capacity).toBe(1);
			if (parsed.kind === 'production') {
				expect(parsed.allowed_recipes).toEqual(['recipe-farm-wheat']);
			}
		});

		it('rejects empty allowed_recipes', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'farm',
					kind: 'production',
					primary_job: 'settler',
					allowed_recipes: [],
				}),
			).toThrow();
		});
	});

	describe('service kind', () => {
		it('parses minimal service facility with defaults', () => {
			const parsed = FacilityTypeSchema.parse({
				id: 'bathhouse',
				kind: 'service',
				primary_job: 'bathhouse_keeper',
				staffed_effects: { mood: 15 },
				unstaffed_effects: { mood: 5 },
			});
			expect(parsed.kind).toBe('service');
			if (parsed.kind === 'service') {
				expect(parsed.cost_per_visit).toBe(0);
				expect(parsed.ticks_per_visit).toBe(20);
				expect(parsed.restock_threshold_per_item).toEqual({});
				expect(parsed.staffed_effects.mood).toBe(15);
				expect(parsed.staffed_effects.energy).toBe(0);
				expect(parsed.staffed_effects.social).toBe(0);
				expect(parsed.staffed_effects.skill_xp).toBe(0);
				expect(parsed.unstaffed_effects.mood).toBe(5);
				expect(parsed.unstaffed_effects.energy).toBe(0);
				expect(parsed.unstaffed_effects.social).toBe(0);
				expect(parsed.unstaffed_effects.skill_xp).toBe(0);
			}
		});

		it('round-trips restock_threshold_per_item', () => {
			const parsed = FacilityTypeSchema.parse({
				id: 'bathhouse',
				kind: 'service',
				primary_job: 'bathhouse_keeper',
				staffed_effects: { mood: 15 },
				unstaffed_effects: { mood: 5 },
				restock_threshold_per_item: { food: 5, water: 10 },
			});
			if (parsed.kind === 'service') {
				expect(parsed.restock_threshold_per_item).toEqual({ food: 5, water: 10 });
			}
		});

		it('rejects ticks_per_visit less than 1', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'bathhouse',
					kind: 'service',
					primary_job: 'bathhouse_keeper',
					staffed_effects: { mood: 15 },
					unstaffed_effects: { mood: 5 },
					ticks_per_visit: 0,
				}),
			).toThrow();
		});
	});

	describe('area_effect kind', () => {
		it('parses minimal area_effect facility with defaults', () => {
			const parsed = FacilityTypeSchema.parse({
				id: 'guard_post',
				kind: 'area_effect',
				primary_job: 'guard',
				funding: 'treasury',
				modifier: { kind: 'mood', delta_per_tick: 2 },
				radius: 150,
			});
			expect(parsed.kind).toBe('area_effect');
			expect(parsed.funding).toBe('treasury');
			if (parsed.kind === 'area_effect') {
				expect(parsed.ticks_per_pulse).toBe(30);
				expect(parsed.radius).toBe(150);
				expect(parsed.modifier.kind).toBe('mood');
				expect(parsed.modifier.delta_per_tick).toBe(2);
			}
		});

		it('rejects radius less than 1', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'guard_post',
					kind: 'area_effect',
					primary_job: 'guard',
					modifier: { kind: 'mood', delta_per_tick: 2 },
					radius: 0,
				}),
			).toThrow();
		});
	});

	describe('discriminated union', () => {
		it('rejects unknown kind', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'foo',
					kind: 'hybrid',
					primary_job: 'x',
				}),
			).toThrow();
		});
	});

	describe('common fields', () => {
		it('rejects id with uppercase letters', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'Farm',
					kind: 'production',
					primary_job: 'settler',
					allowed_recipes: ['recipe-farm-wheat'],
				}),
			).toThrow();
		});

		it('rejects id with hyphens', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'guard-post',
					kind: 'area_effect',
					primary_job: 'guard',
					modifier: { kind: 'mood', delta_per_tick: 2 },
					radius: 150,
				}),
			).toThrow();
		});

		it('defaults default_wage to 3 when omitted', () => {
			const parsed = FacilityTypeSchema.parse({
				id: 'farm',
				kind: 'production',
				primary_job: 'settler',
				allowed_recipes: ['recipe-farm-wheat'],
			});
			expect(parsed.default_wage).toBe(3);
		});

		it('rejects negative default_wage', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'farm',
					kind: 'production',
					primary_job: 'settler',
					allowed_recipes: ['recipe-farm-wheat'],
					default_wage: -1,
				}),
			).toThrow();
		});

		it('rejects negative default_fund', () => {
			expect(() =>
				FacilityTypeSchema.parse({
					id: 'farm',
					kind: 'production',
					primary_job: 'settler',
					allowed_recipes: ['recipe-farm-wheat'],
					default_fund: -1,
				}),
			).toThrow();
		});
	});
});
