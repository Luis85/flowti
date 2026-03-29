import { clamp } from '../core/math-utils.js';

export interface FeedInput {
	currentHunger: number;
}

export interface FeedConfig {
	recovery_rate: number;
}

export interface FeedResult {
	newHunger: number;
	recovered: number;
}

export function applyFeed(input: FeedInput, config: FeedConfig): FeedResult {
	const newHunger = clamp(input.currentHunger + config.recovery_rate, 0, 100);
	return {
		newHunger,
		recovered: newHunger - input.currentHunger,
	};
}
