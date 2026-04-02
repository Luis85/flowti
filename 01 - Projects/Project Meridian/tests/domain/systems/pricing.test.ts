import { describe, it, expect } from 'vitest';
import { calculatePostedPrice, type PricingInput } from '../../../src/domain/systems/pricing.js';

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
	return {
		baseValue: 10,
		demandRate: 5,
		supplyCount: 5,
		locationHops: 0,
		elasticity: 1.0,
		pipelineModifiers: [],
		clampMin: 0.5,
		clampMax: 3.0,
		...overrides,
	};
}

describe('calculatePostedPrice', () => {
	it('returns baseValue when demand equals supply and no modifiers', () => {
		const price = calculatePostedPrice(baseInput());
		expect(price).toBe(10);
	});

	it('increases price when demand exceeds supply', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5 }));
		expect(price).toBeGreaterThan(10);
	});

	it('decreases price when supply exceeds demand', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 2, supplyCount: 5 }));
		expect(price).toBeLessThan(10);
	});

	it('amplifies scarcity with high elasticity (subsistence)', () => {
		const normal = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.0 }));
		const elastic = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.5 }));
		expect(elastic).toBeGreaterThan(normal);
	});

	it('dampens scarcity with low elasticity (luxury)', () => {
		const normal = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 1.0 }));
		const inelastic = calculatePostedPrice(baseInput({ demandRate: 10, supplyCount: 5, elasticity: 0.4 }));
		expect(inelastic).toBeLessThan(normal);
	});

	it('increases price with location hops', () => {
		const local = calculatePostedPrice(baseInput({ locationHops: 0 }));
		const distant = calculatePostedPrice(baseInput({ locationHops: 3 }));
		expect(distant).toBeGreaterThan(local);
	});

	it('applies pipeline modifiers multiplicatively', () => {
		const price = calculatePostedPrice(baseInput({ pipelineModifiers: [1.2, 0.8] }));
		// 1.2 * 0.8 = 0.96 — slight discount
		expect(price).toBeCloseTo(10 * 0.96, 1);
	});

	it('clamps price to minimum', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 0, supplyCount: 100, clampMin: 0.5 }));
		expect(price).toBeCloseTo(10 * 0.5);
	});

	it('clamps price to maximum', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 100, supplyCount: 1, clampMax: 3.0 }));
		expect(price).toBeCloseTo(10 * 3.0);
	});

	it('handles zero supply without division error', () => {
		const price = calculatePostedPrice(baseInput({ supplyCount: 0 }));
		expect(price).toBeCloseTo(10 * 3.0);
		expect(Number.isFinite(price)).toBe(true);
	});

	it('handles zero demand', () => {
		const price = calculatePostedPrice(baseInput({ demandRate: 0 }));
		expect(price).toBeCloseTo(10 * 0.5);
	});
});
