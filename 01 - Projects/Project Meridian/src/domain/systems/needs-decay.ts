import type { NeedsState } from '../core/component-data.js';
import { clamp, round2 } from '../core/math-utils.js';
import { NEED_CRITICAL_THRESHOLDS } from '../schemas/ranges.js';

export interface NeedsDecayInput {
	state: NeedsState;
	hungerAttribute: number;
	energyAttribute: number;
	socialAttribute: number;
	thirstAttribute: number;
	modifiers: NeedsModifiers | null;
	/**
	 * Optional per-tick, per-agent multiplier (symmetric around 1.0) that prevents
	 * identical agents from converging to identical need states. Intended to be
	 * computed from agent id + tick so it's deterministic and replay-stable.
	 * Default = 1.0 (no jitter).
	 */
	jitterFactor?: number;
}

export interface NeedsModifiers {
	hungerDecayScale?: number;
	energyDecayScale?: number;
	socialDecayScale?: number;
	thirstDecayScale?: number;
}

export interface NeedEvent {
	type: 'NeedChanged' | 'NeedCritical' | 'AgentExhausted';
	need: 'hunger' | 'energy' | 'social' | 'thirst';
	oldValue: number;
	newValue: number;
	value?: number;
	threshold?: number;
}

export interface NeedsDecayResult {
	state: NeedsState;
	events: NeedEvent[];
}

interface NeedConfig {
	key: 'hunger' | 'energy' | 'social' | 'thirst';
	decayRate: number;
	attribute: number;
	modifierScale: number;
	criticalThreshold: number;
}

function eventsForNeed(need: NeedConfig, oldValue: number, newValue: number): NeedEvent[] {
	const result: NeedEvent[] = [];
	if (newValue !== oldValue) {
		result.push({ type: 'NeedChanged', need: need.key, oldValue, newValue });
	}
	if (newValue < need.criticalThreshold && newValue > 0 && oldValue >= need.criticalThreshold) {
		result.push({ type: 'NeedCritical', need: need.key, oldValue, newValue, value: newValue, threshold: need.criticalThreshold });
	}
	if (need.key === 'energy' && newValue === 0) {
		result.push({ type: 'AgentExhausted', need: 'energy', oldValue, newValue });
	}
	return result;
}

export function applyNeedsDecay(
	input: NeedsDecayInput,
	config: { hunger_decay: number; energy_decay: number; social_decay: number; thirst_decay: number },
): NeedsDecayResult {
	const events: NeedEvent[] = [];
	const state = { ...input.state };

	const needs: NeedConfig[] = [
		{
			key: 'hunger',
			decayRate: config.hunger_decay,
			attribute: input.hungerAttribute,
			modifierScale: input.modifiers?.hungerDecayScale ?? 1.0,
			criticalThreshold: NEED_CRITICAL_THRESHOLDS.hunger,
		},
		{
			key: 'energy',
			decayRate: config.energy_decay,
			attribute: input.energyAttribute,
			modifierScale: input.modifiers?.energyDecayScale ?? 1.0,
			criticalThreshold: NEED_CRITICAL_THRESHOLDS.energy,
		},
		{
			key: 'social',
			decayRate: config.social_decay,
			attribute: input.socialAttribute,
			modifierScale: input.modifiers?.socialDecayScale ?? 1.0,
			criticalThreshold: 0, // social is not a survival need — never fires critical
		},
		{
			key: 'thirst',
			decayRate: config.thirst_decay,
			attribute: input.thirstAttribute,
			modifierScale: input.modifiers?.thirstDecayScale ?? 1.0,
			criticalThreshold: NEED_CRITICAL_THRESHOLDS.thirst,
		},
	];

	const jitter = input.jitterFactor ?? 1.0;
	for (const need of needs) {
		const oldValue = state[need.key];
		if (oldValue === 0) continue;
		const decay = (need.decayRate / (need.attribute / 10)) * need.modifierScale * jitter;
		const newValue = round2(clamp(oldValue - decay, 0, 100));
		state[need.key] = newValue;
		events.push(...eventsForNeed(need, oldValue, newValue));
	}

	return { state, events };
}
