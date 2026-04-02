import { describe, it, expect } from 'vitest';
import { calculatePostedPrice } from '../../src/domain/systems/pricing.js';
import { createDemandTracker, recordConsumption, getDemandRate } from '../../src/domain/systems/demand-tracker.js';
import { recalculateFacilityPrices } from '../../src/domain/systems/economy.js';

describe('Economy flow integration', () => {
	it('price increases when consumption rises', () => {
		const tracker = createDemandTracker(100);
		const elasticityMap = { subsistence: 1.5, comfort: 1.0, trade_goods: 0.7, luxury: 0.4 };

		// Initial price with low demand
		const priceBefore = recalculateFacilityPrices({
			facilityId: 'bakery',
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 10 }],
			demandRates: { bread: getDemandRate(tracker, 'bread', 50) },
			locationHops: 0,
			pipelineModifiers: [],
			elasticityMap,
			clampMin: 0.5,
			clampMax: 3.0,
		});

		// Simulate heavy consumption
		for (let i = 0; i < 20; i++) {
			recordConsumption(tracker, 'bread', 1, 50 + i);
		}

		// Recalculate with new demand
		const priceAfter = recalculateFacilityPrices({
			facilityId: 'bakery',
			items: [{ itemId: 'bread', baseValue: 5, category: 'subsistence', stock: 5 }],
			demandRates: { bread: getDemandRate(tracker, 'bread', 70) },
			locationHops: 0,
			pipelineModifiers: [],
			elasticityMap,
			clampMin: 0.5,
			clampMax: 3.0,
		});

		expect(priceAfter.bread).toBeGreaterThan(priceBefore.bread);
	});

	it('subsistence items swing harder than luxury items under same conditions', () => {
		const tracker = createDemandTracker(100);
		const elasticityMap = { subsistence: 1.5, luxury: 0.4 };

		for (let i = 0; i < 15; i++) {
			recordConsumption(tracker, 'bread', 1, i);
			recordConsumption(tracker, 'gem', 1, i);
		}

		const breadPrice = calculatePostedPrice({
			baseValue: 10, demandRate: getDemandRate(tracker, 'bread', 20),
			supplyCount: 5, locationHops: 0, elasticity: 1.5,
			pipelineModifiers: [], clampMin: 0.5, clampMax: 3.0,
		});

		const gemPrice = calculatePostedPrice({
			baseValue: 10, demandRate: getDemandRate(tracker, 'gem', 20),
			supplyCount: 5, locationHops: 0, elasticity: 0.4,
			pipelineModifiers: [], clampMin: 0.5, clampMax: 3.0,
		});

		expect(breadPrice).toBeGreaterThan(gemPrice);
	});
});
