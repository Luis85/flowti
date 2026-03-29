import { describe, it, expect } from 'vitest';
import { applySkillProgression } from '../../../src/domain/systems/skill-progression.js';
import type { SkillProgressionInput } from '../../../src/domain/systems/skill-progression.js';

function baseInput(overrides: Partial<SkillProgressionInput> = {}): SkillProgressionInput {
	return {
		points: 5,
		useCount: 5,
		useBonus: 0,
		thresholds: [10, 25, 50],
		maxUseBonus: 3,
		...overrides,
	};
}

describe('applySkillProgression', () => {
	it('increments points and use count', () => {
		const result = applySkillProgression(baseInput());
		expect(result.newPoints).toBe(6);
		expect(result.newUseCount).toBe(6);
	});

	it('improves use_bonus when crossing first threshold', () => {
		const result = applySkillProgression(baseInput({ useCount: 9, useBonus: 0 }));
		expect(result.newUseCount).toBe(10);
		expect(result.newUseBonus).toBe(1);
		expect(result.improved).toBe(true);
	});

	it('improves use_bonus when crossing second threshold', () => {
		const result = applySkillProgression(baseInput({ useCount: 24, useBonus: 1 }));
		expect(result.newUseCount).toBe(25);
		expect(result.newUseBonus).toBe(2);
		expect(result.improved).toBe(true);
	});

	it('caps use_bonus at maxUseBonus', () => {
		const result = applySkillProgression(baseInput({ useCount: 99, useBonus: 2, maxUseBonus: 2 }));
		expect(result.newUseBonus).toBe(2);
		expect(result.improved).toBe(false);
	});

	it('does not improve between thresholds', () => {
		const result = applySkillProgression(baseInput({ useCount: 15, useBonus: 1 }));
		expect(result.newUseCount).toBe(16);
		expect(result.newUseBonus).toBe(1);
		expect(result.improved).toBe(false);
	});

	it('handles starting from zero', () => {
		const result = applySkillProgression(baseInput({ points: 0, useCount: 0, useBonus: 0 }));
		expect(result.newPoints).toBe(1);
		expect(result.newUseCount).toBe(1);
		expect(result.newUseBonus).toBe(0);
		expect(result.improved).toBe(false);
	});
});
