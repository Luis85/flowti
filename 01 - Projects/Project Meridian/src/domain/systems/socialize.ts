import { clamp } from '../core/math-utils.js';
import type { MemoryEntry } from '../core/component-data.js';

export interface SocializeInput {
	agentId: string;
	agentName: string;
	partnerId: string;
	partnerName: string;
	currentSocial: number;
	currentTick: number;
	lastSocialTick: number | null;
}

export interface SocializeConfig {
	recovery_rate: number;
	memory_significance: number;
	memory_mood_impact: number;
	cooldown_ticks: number;
}

export interface SocializeResult {
	newSocial: number;
	recovered: number;
	memory: MemoryEntry | null;
}

export function applySocialize(input: SocializeInput, config: SocializeConfig): SocializeResult {
	const newSocial = clamp(input.currentSocial + config.recovery_rate, 0, 100);
	const recovered = newSocial - input.currentSocial;

	const onCooldown = input.lastSocialTick !== null
		&& (input.currentTick - input.lastSocialTick) < config.cooldown_ticks;

	const memory: MemoryEntry | null = onCooldown ? null : {
		tick: input.currentTick,
		type: 'social',
		description: `Talked with ${input.partnerName}`,
		participants: [input.partnerId],
		outcome: 'positive',
		significance: config.memory_significance,
		mood_impact: config.memory_mood_impact,
	};

	return { newSocial, recovered, memory };
}
