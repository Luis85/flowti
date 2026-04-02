import { describe, it, expect } from 'vitest';
import { calculateReservationPrice } from '../../../src/domain/systems/utility.js';

describe('calculateReservationPrice', () => {
	const base = {
		baseValue: 5,
		needThreshold: 40,
		walletGold: 30,
		urgencyMax: 3,
		stockFactor: 0.5,
		budgetCap: 0.3,
		budgetCapCritical: 0.8,
	};

	it('returns higher price when need is critical (hunger=10)', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0 });
		expect(price).toBeGreaterThan(5);
	});

	it('returns lower price when well-fed (hunger=80)', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 80, currentStock: 0 });
		expect(price).toBeLessThan(5);
	});

	it('diminishes with more stock', () => {
		const price0 = calculateReservationPrice({ ...base, needLevel: 30, currentStock: 0 });
		const price3 = calculateReservationPrice({ ...base, needLevel: 30, currentStock: 3 });
		expect(price3).toBeLessThan(price0);
	});

	it('caps at 30% of wallet when not critical', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 60, currentStock: 0, walletGold: 10 });
		expect(price).toBeLessThanOrEqual(3);
	});

	it('caps at 80% of wallet when critical', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0, walletGold: 10 });
		expect(price).toBeLessThanOrEqual(8);
	});

	it('returns 0 when wallet is empty', () => {
		const price = calculateReservationPrice({ ...base, needLevel: 10, currentStock: 0, walletGold: 0 });
		expect(price).toBe(0);
	});
});
