import { describe, it, expect } from 'vitest';
import { calculatePostedPrice } from '../../src/domain/systems/pricing.js';
import { createDemandTracker, recordConsumption, getDemandRate } from '../../src/domain/systems/demand-tracker.js';
import { recalculateFacilityPrices } from '../../src/domain/systems/economy.js';
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	getEffectiveTaxRate,
	evaluateSafetyNets,
} from '../../src/domain/systems/monetary-policy.js';

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

describe('Monetary policy domain flow', () => {
	it('monetary snapshot includes all gold flow categories', () => {
		const ledger = createMonetaryLedger(500);

		// Simulate all flow types
		recordFlow(ledger, { category: 'transfer', subcategory: 'purchase', amount: 5, tick: 10, fromEntity: 'agent-1', toEntity: 'loc-bakery' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'wage', amount: 3, tick: 10, fromEntity: 'loc-farm', toEntity: 'agent-2' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'tax', amount: 0.3, tick: 10, fromEntity: 'loc-farm', toEntity: 'treasury' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'stipend', amount: 2, tick: 10, fromEntity: 'treasury', toEntity: 'agent-1' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'subsidy', amount: 30, tick: 10, fromEntity: 'treasury', toEntity: 'loc-bakery' });
		recordFlow(ledger, { category: 'transfer', subcategory: 'rest', amount: 1, tick: 10, fromEntity: 'agent-1', toEntity: 'loc-tavern' });
		recordFlow(ledger, { category: 'faucet', subcategory: 'treasury_regen', amount: 50, tick: 10, fromEntity: null, toEntity: 'treasury' });

		const snap = calculateMonetarySnapshot(ledger, 20, [100, 80], 500);

		// All transfers included in velocity
		expect(snap.velocity).toBeGreaterThan(0);
		// Faucet tracked
		expect(snap.faucetRate).toBe(50);
		// Money supply = agent balances + treasury
		expect(snap.moneySupply).toBe(680);
	});

	it('velocity drops → stimulus triggers → tax adjusts', () => {
		const ledger = createMonetaryLedger(100);
		const balances = [100, 80, 60];
		const treasury = 200;

		// Healthy economy — lots of transfers
		for (let tick = 0; tick < 50; tick++) {
			recordFlow(ledger, {
				category: 'transfer', subcategory: 'purchase',
				amount: 5, tick, fromEntity: 'a', toEntity: 'b',
			});
		}

		const healthySnap = calculateMonetarySnapshot(ledger, 50, balances, treasury);
		expect(healthySnap.velocity).toBeGreaterThan(0.2);

		// Economy stagnates — no transfers for 100 ticks
		const stagnantSnap = calculateMonetarySnapshot(ledger, 200, balances, treasury);
		expect(stagnantSnap.velocity).toBe(0);

		// Safety nets trigger
		const interventions = evaluateSafetyNets(
			stagnantSnap.velocity, 60,
			{ stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 },
		);
		expect(interventions).toContain('stimulus');
		expect(interventions).toContain('recovery_event');

		// Tax rate adjusts
		const taxRate = getEffectiveTaxRate(
			0.10, stagnantSnap.velocity,
			{ stagnant: 0.2, overheated: 1.5 },
			{ stagnant: 0.5, overheated: 1.5 },
		);
		expect(taxRate).toBeCloseTo(0.05);
	});
});
