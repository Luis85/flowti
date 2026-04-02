import { describe, it, expect } from 'vitest';
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	getEffectiveTaxRate,
	evaluateSafetyNets,
	type MonetaryLedger,
} from '../../../src/domain/systems/monetary-policy.js';
import type { GoldFlow } from '../../../src/domain/core/component-data.js';

function baseLedger(windowSize = 100): MonetaryLedger {
	return createMonetaryLedger(windowSize);
}

function transfer(amount: number, tick: number): GoldFlow {
	return { category: 'transfer', subcategory: 'purchase', amount, tick, fromEntity: 'agent-1', toEntity: 'bakery' };
}

function faucet(amount: number, tick: number): GoldFlow {
	return { category: 'faucet', subcategory: 'treasury_regen', amount, tick, fromEntity: null, toEntity: 'treasury' };
}

function sink(amount: number, tick: number): GoldFlow {
	return { category: 'sink', subcategory: 'repair', amount, tick, fromEntity: 'agent-1', toEntity: null };
}

describe('MonetaryLedger', () => {
	it('starts empty', () => {
		const ledger = baseLedger();
		expect(ledger.flows).toHaveLength(0);
	});

	it('records flows', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 50));
		expect(ledger.flows).toHaveLength(1);
	});
});

describe('calculateMonetarySnapshot', () => {
	it('calculates money supply from all balances', () => {
		const ledger = baseLedger();
		const snap = calculateMonetarySnapshot(ledger, 50, [100, 50, 30], 200);
		expect(snap.moneySupply).toBe(380);
	});

	it('calculates velocity as transfers / money supply', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 40));
		recordFlow(ledger, transfer(20, 45));
		const snap = calculateMonetarySnapshot(ledger, 50, [100], 0);
		expect(snap.velocity).toBeCloseTo(30 / 100);
	});

	it('excludes flows outside window', () => {
		const ledger = baseLedger(100);
		recordFlow(ledger, transfer(10, 10));
		recordFlow(ledger, transfer(20, 120));
		const snap = calculateMonetarySnapshot(ledger, 150, [100], 0);
		// Only tick 120 is in window [50, 150]
		expect(snap.velocity).toBeCloseTo(20 / 100);
	});

	it('separates faucets and sinks', () => {
		const ledger = baseLedger();
		recordFlow(ledger, faucet(50, 40));
		recordFlow(ledger, sink(10, 45));
		recordFlow(ledger, transfer(30, 48));
		const snap = calculateMonetarySnapshot(ledger, 50, [100], 0);
		expect(snap.faucetRate).toBe(50);
		expect(snap.sinkRate).toBe(10);
		expect(snap.netFlow).toBe(40);
	});

	it('handles zero money supply without division error', () => {
		const ledger = baseLedger();
		recordFlow(ledger, transfer(10, 40));
		const snap = calculateMonetarySnapshot(ledger, 50, [], 0);
		expect(snap.velocity).toBe(0);
	});

	it('prunes flows older than window', () => {
		const ledger = baseLedger(100);
		recordFlow(ledger, transfer(10, 10));
		recordFlow(ledger, transfer(20, 120));
		calculateMonetarySnapshot(ledger, 150, [100], 0);
		expect(ledger.flows).toHaveLength(1);
	});
});

describe('getEffectiveTaxRate', () => {
	it('returns base rate in healthy range', () => {
		expect(getEffectiveTaxRate(0.10, 0.5, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBe(0.10);
	});

	it('reduces tax when stagnant', () => {
		expect(getEffectiveTaxRate(0.10, 0.1, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBeCloseTo(0.05);
	});

	it('increases tax when overheated', () => {
		expect(getEffectiveTaxRate(0.10, 2.0, { stagnant: 0.2, overheated: 1.5 }, { stagnant: 0.5, overheated: 1.5 }))
			.toBeCloseTo(0.15);
	});
});

describe('evaluateSafetyNets', () => {
	it('returns no interventions when velocity is healthy', () => {
		const result = evaluateSafetyNets(0.5, 0, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toHaveLength(0);
	});

	it('triggers stimulus after enough stagnant ticks', () => {
		const result = evaluateSafetyNets(0.1, 60, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toContain('stimulus');
	});

	it('triggers emergency recovery at critical velocity', () => {
		const result = evaluateSafetyNets(0.05, 0, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).toContain('recovery_event');
	});

	it('does not trigger stimulus before threshold', () => {
		const result = evaluateSafetyNets(0.1, 30, { stagnant: 0.2, critical: 0.1, stimulusTriggerTicks: 50 });
		expect(result).not.toContain('stimulus');
	});
});
