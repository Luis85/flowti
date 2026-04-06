import { clamp } from '../core/math-utils.js';

export interface MoodFactors {
	needsSatisfaction: number;
	positiveMemories: number;
	negativeMemories: number;
	goalProgress: number;
	walletHealth: number;
	equipmentCondition: number;
	relationshipQuality: number;
}

export interface MoodConfig {
	factor_weights: {
		needs: number;
		positive_memories: number;
		negative_memories: number;
		goal_progress: number;
		wallet: number;
		equipment: number;
		relationships: number;
	};
	buckets: { name: string; min: number; max: number }[];
	external_modifier_cap: number;
}

export interface MoodResult {
	value: number;
	bucket: string;
	changed: boolean;
}

export function calculateMood(
	factors: MoodFactors,
	previousBucket: string,
	config: MoodConfig,
	externalModifiers: number,
): MoodResult {
	const w = config.factor_weights;

	const positivePart =
		factors.needsSatisfaction * w.needs
		+ factors.positiveMemories * w.positive_memories
		+ factors.goalProgress * w.goal_progress
		+ factors.walletHealth * w.wallet
		+ factors.equipmentCondition * w.equipment
		+ factors.relationshipQuality * w.relationships;

	const negativePart = factors.negativeMemories * w.negative_memories;

	// Exclude memory weights when no memories exist (both positive and negative are 0)
	const hasMemories = factors.positiveMemories > 0 || factors.negativeMemories > 0;
	const totalWeight = hasMemories
		? w.needs + w.positive_memories + w.negative_memories + w.goal_progress + w.wallet + w.equipment + w.relationships
		: w.needs + w.goal_progress + w.wallet + w.equipment + w.relationships;

	// Recentered formula: factor-average 0.5 maps to mood 0
	const rawMood = ((positivePart - negativePart) / totalWeight - 0.5) * 200;
	const value = clamp(Math.round(rawMood + externalModifiers), -100, 100);

	let bucket = 'stressed';
	for (const b of config.buckets) {
		if (value >= b.min && value <= b.max) {
			bucket = b.name;
			break;
		}
	}

	return { value, bucket, changed: bucket !== previousBucket };
}
