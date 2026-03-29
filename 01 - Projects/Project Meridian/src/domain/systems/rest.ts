import { clamp } from '../core/math-utils.js';

export interface RestInput {
	currentEnergy: number;
	restTier: 'owned_home' | 'public_shelter' | 'outdoors';
}

export interface RestTierConfig {
	recovery_rate: number;
	mood_effect: number;
}

export interface RestConfig {
	owned_home: RestTierConfig;
	public_shelter: RestTierConfig;
	outdoors: RestTierConfig;
}

export interface RestResult {
	newEnergy: number;
	recovered: number;
	moodEffect: number;
	tier: string;
}

export function applyRest(input: RestInput, config: RestConfig): RestResult {
	const tierConfig = config[input.restTier];
	const newEnergy = clamp(input.currentEnergy + tierConfig.recovery_rate, 0, 100);
	return {
		newEnergy,
		recovered: newEnergy - input.currentEnergy,
		moodEffect: tierConfig.mood_effect,
		tier: input.restTier,
	};
}
