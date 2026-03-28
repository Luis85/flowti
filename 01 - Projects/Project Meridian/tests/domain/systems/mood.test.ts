import { describe, it, expect } from 'vitest';
import { calculateMood } from '../../../src/domain/systems/mood.js';
import type { MoodFactors } from '../../../src/domain/systems/mood.js';

const defaultWeights = {
	needs: 30, positive_memories: 20, negative_memories: 20,
	goal_progress: 10, wallet: 10, equipment: 5, relationships: 5,
};

const defaultBuckets = [
	{ name: 'elated', min: 60, max: 100 },
	{ name: 'content', min: 20, max: 59 },
	{ name: 'stressed', min: -19, max: 19 },
	{ name: 'distressed', min: -59, max: -20 },
	{ name: 'breakdown', min: -100, max: -60 },
];

const defaultConfig = { factor_weights: defaultWeights, buckets: defaultBuckets, external_modifier_cap: 30 };

function makeFactors(overrides: Partial<MoodFactors> = {}): MoodFactors {
	return {
		needsSatisfaction: 0.5,
		positiveMemories: 0,
		negativeMemories: 0,
		goalProgress: 0,
		walletHealth: 0,
		equipmentCondition: 0,
		relationshipQuality: 0,
		...overrides,
	};
}

describe('calculateMood', () => {
	it('full needs satisfaction with no other factors → positive mood', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), '', defaultConfig, 0);
		expect(result.value).toBeGreaterThan(-50);
		expect(result.value).toBeLessThan(0);
		expect(result.bucket).toBe('distressed');
	});

	it('all factors at maximum → elated', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(60);
		expect(result.bucket).toBe('elated');
	});

	it('negative memories lower mood', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			negativeMemories: 1.0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(-80);
		expect(result.bucket).toBe('breakdown');
	});

	it('positive memories increase mood', () => {
		const baseResult = calculateMood(makeFactors({ needsSatisfaction: 0.5 }), '', defaultConfig, 0);
		const withPositive = calculateMood(makeFactors({ needsSatisfaction: 0.5, positiveMemories: 0.5 }), '', defaultConfig, 0);
		expect(withPositive.value).toBeGreaterThan(baseResult.value);
	});

	it('bucket changed flag is true when bucket transitions', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'content', defaultConfig, 0);
		expect(result.changed).toBe(true);
	});

	it('bucket changed flag is false when bucket stays the same', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'distressed', defaultConfig, 0);
		expect(result.changed).toBe(false);
	});

	it('external modifiers apply and clamp to [-100, 100]', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 50);
		expect(result.value).toBe(100);
	});

	it('all factors zero → lowest possible mood', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(-100);
		expect(result.bucket).toBe('breakdown');
	});
});
