import { describe, it, expect } from 'vitest';
import { applyRest } from '../../../src/domain/systems/rest.js';

const defaultConfig = {
	owned_home: { recovery_rate: 2.0, mood_effect: 2 },
	public_shelter: { recovery_rate: 1.5, mood_effect: 0 },
	outdoors: { recovery_rate: 1.0, mood_effect: -3 },
};

describe('applyRest', () => {
	it('recovers energy at owned_home rate', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(52);
		expect(result.recovered).toBe(2);
		expect(result.moodEffect).toBe(2);
		expect(result.tier).toBe('owned_home');
	});

	it('recovers energy at public_shelter rate', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'public_shelter' }, defaultConfig);
		expect(result.newEnergy).toBe(51.5);
		expect(result.recovered).toBe(1.5);
		expect(result.moodEffect).toBe(0);
	});

	it('recovers energy at outdoors rate with negative mood', () => {
		const result = applyRest({ currentEnergy: 50, restTier: 'outdoors' }, defaultConfig);
		expect(result.newEnergy).toBe(51);
		expect(result.moodEffect).toBe(-3);
	});

	it('clamps energy to 100', () => {
		const result = applyRest({ currentEnergy: 99.5, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(100);
		expect(result.recovered).toBe(0.5);
	});

	it('does not recover past 100', () => {
		const result = applyRest({ currentEnergy: 100, restTier: 'owned_home' }, defaultConfig);
		expect(result.newEnergy).toBe(100);
		expect(result.recovered).toBe(0);
	});
});
