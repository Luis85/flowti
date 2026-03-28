import type { NeedsState } from '../core/component-data.js';

export interface NeedsDecayInput {
	state: NeedsState;
	hungerAttribute: number;
	energyAttribute: number;
	socialAttribute: number;
	modifiers: NeedsModifiers | null;
}

export interface NeedsModifiers {
	hungerDecayScale?: number;
	energyDecayScale?: number;
	socialDecayScale?: number;
}

export interface NeedEvent {
	type: 'NeedChanged' | 'NeedCritical' | 'AgentExhausted';
	need: 'hunger' | 'energy' | 'social';
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
	key: 'hunger' | 'energy' | 'social';
	decayRate: number;
	attribute: number;
	modifierScale: number;
	criticalThreshold: number;
}

const CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, social: 25 } as const;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
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
	config: { hunger_decay: number; energy_decay: number; social_decay: number },
): NeedsDecayResult {
	const events: NeedEvent[] = [];
	const state = { ...input.state };

	const needs: NeedConfig[] = [
		{
			key: 'hunger',
			decayRate: config.hunger_decay,
			attribute: input.hungerAttribute,
			modifierScale: input.modifiers?.hungerDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.hunger,
		},
		{
			key: 'energy',
			decayRate: config.energy_decay,
			attribute: input.energyAttribute,
			modifierScale: input.modifiers?.energyDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.energy,
		},
		{
			key: 'social',
			decayRate: config.social_decay,
			attribute: input.socialAttribute,
			modifierScale: input.modifiers?.socialDecayScale ?? 1.0,
			criticalThreshold: CRITICAL_THRESHOLDS.social,
		},
	];

	for (const need of needs) {
		const oldValue = state[need.key];
		if (oldValue === 0) continue;
		const decay = (need.decayRate / (need.attribute / 10)) * need.modifierScale;
		const newValue = round2(clamp(oldValue - decay, 0, 100));
		state[need.key] = newValue;
		events.push(...eventsForNeed(need, oldValue, newValue));
	}

	return { state, events };
}
