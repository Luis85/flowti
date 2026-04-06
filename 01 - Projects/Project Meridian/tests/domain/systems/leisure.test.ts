import { describe, it, expect } from 'vitest';
import { applyLeisureTick } from '../../../src/domain/systems/leisure.js';

describe('applyLeisureTick', () => {
	it('applies social gain per tick', () => {
		const result = applyLeisureTick({
			currentSocial: 40,
			currentEnergy: 50,
			effects: { social: 15, mood: 5, energy: 0, skill_xp: 0 },
			ticksPerVisit: 15,
		});
		expect(result.newSocial).toBeCloseTo(41);
		expect(result.newEnergy).toBe(50);
	});

	it('applies energy gain per tick', () => {
		const result = applyLeisureTick({
			currentSocial: 50,
			currentEnergy: 40,
			effects: { social: 0, mood: 0, energy: 20, skill_xp: 0 },
			ticksPerVisit: 10,
		});
		expect(result.newSocial).toBe(50);
		expect(result.newEnergy).toBeCloseTo(42);
	});

	it('clamps social and energy to 100', () => {
		const result = applyLeisureTick({
			currentSocial: 99,
			currentEnergy: 99,
			effects: { social: 100, mood: 0, energy: 100, skill_xp: 0 },
			ticksPerVisit: 1,
		});
		expect(result.newSocial).toBe(100);
		expect(result.newEnergy).toBe(100);
	});

	it('handles zero effects', () => {
		const result = applyLeisureTick({
			currentSocial: 50,
			currentEnergy: 50,
			effects: { social: 0, mood: 0, energy: 0, skill_xp: 0 },
			ticksPerVisit: 15,
		});
		expect(result.newSocial).toBe(50);
		expect(result.newEnergy).toBe(50);
	});
});
