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
	it('full needs satisfaction with no other factors → neutral mood', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), '', defaultConfig, 0);
		// No memories → totalWeight=60, positivePart=30, rawMood=(30/60-0.5)*200=0
		expect(result.value).toBe(0);
		expect(result.bucket).toBe('stressed');
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
		// Has memories → totalWeight=100, positivePart=30, negativePart=20, rawMood=((30-20)/100-0.5)*200=-80
		expect(result.value).toBe(-80);
		expect(result.bucket).toBe('breakdown');
	});

	it('positive memories increase mood', () => {
		const baseResult = calculateMood(makeFactors({ needsSatisfaction: 0.5 }), '', defaultConfig, 0);
		const withPositive = calculateMood(makeFactors({ needsSatisfaction: 0.5, positiveMemories: 1.0 }), '', defaultConfig, 0);
		expect(withPositive.value).toBeGreaterThan(baseResult.value);
	});

	it('bucket changed flag is true when bucket transitions', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'content', defaultConfig, 0);
		expect(result.changed).toBe(true);
	});

	it('bucket changed flag is false when bucket stays the same', () => {
		// needsSatisfaction=1.0, no memories → mood=0, bucket='stressed'
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'stressed', defaultConfig, 0);
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

	it('all factors at maximum without memories → elated', () => {
		// No memories → effectivePositiveMemories=0.5, totalWeight=80
		// positivePart=30+10+10+10+5+5=70, rawMood=(70/80-0.5)*200=75
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(75);
		expect(result.bucket).toBe('elated');
	});

	it('all factors zero → lowest possible mood', () => {
		// No memories → effectivePositiveMemories=0.5, totalWeight=80
		// positivePart=0+10+0+0+0+0=10, rawMood=(10/80-0.5)*200=-75
		const result = calculateMood(makeFactors({
			needsSatisfaction: 0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(-75);
		expect(result.bucket).toBe('breakdown');
	});
});
