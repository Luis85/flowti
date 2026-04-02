import { describe, it, expect } from 'vitest';
import {
	shouldRecalculate,
	recalculateFacilityPrices,
	type FacilityPricingContext,
} from '../../../src/domain/systems/economy.js';

function baseFacility(overrides: Partial<FacilityPricingContext> = {}): FacilityPricingContext {
	return {
		facilityId: 'bakery',
		items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 10 }],
		demandRates: { bread: 8 },
		locationHops: 0,
		pipelineModifiers: [],
		elasticityMap: { subsistence: 1.5, comfort: 1.0, trade_goods: 0.7, luxury: 0.4 },
		clampMin: 0.5,
		clampMax: 3.0,
		...overrides,
	};
}

describe('shouldRecalculate', () => {
	it('returns true when current tick >= scheduled tick', () => {
		expect(shouldRecalculate(100, 100)).toBe(true);
		expect(shouldRecalculate(100, 99)).toBe(true);
	});

	it('returns false when current tick < scheduled tick', () => {
		expect(shouldRecalculate(100, 101)).toBe(false);
	});
});

describe('recalculateFacilityPrices', () => {
	it('returns prices for all items', () => {
		const result = recalculateFacilityPrices(baseFacility());
		expect(result).toHaveProperty('bread');
		expect(result.bread).toBeGreaterThan(0);
	});

	it('applies elasticity per category', () => {
		const subsistence = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'bread', baseValue: 10, category: 'subsistence', stock: 5 }],
			demandRates: { bread: 10 },
		}));
		const luxury = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'gem', baseValue: 10, category: 'luxury', stock: 5 }],
			demandRates: { gem: 10 },
		}));
		expect(subsistence.bread).toBeGreaterThan(luxury.gem);
	});

	it('uses fallback elasticity 1.0 for unknown category', () => {
		const result = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'potion', baseValue: 10, category: 'alchemy', stock: 5 }],
			demandRates: { potion: 5 },
		}));
		expect(result.potion).toBeCloseTo(10);
	});

	it('handles items with zero stock', () => {
		const result = recalculateFacilityPrices(baseFacility({
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 0 }],
		}));
		expect(Number.isFinite(result.bread)).toBe(true);
	});
});
