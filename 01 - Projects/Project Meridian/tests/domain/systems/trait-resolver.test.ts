import { describe, it, expect } from 'vitest';
import { resolveTraitModifiers } from '../../../src/domain/systems/trait-resolver.js';
import type { TraitDefinition } from '../../../src/domain/systems/trait-resolver.js';

describe('TraitResolver', () => {
	const traits: Record<string, TraitDefinition> = {
		'trait-resilient': {
			id: 'trait-resilient',
			effects: [
				{ system: 'NeedsDecaySystem', modifier: { hunger_decay: 0.5, energy_decay: 0.5 } },
			],
			conflicts_with: [],
		},
		'trait-workaholic': {
			id: 'trait-workaholic',
			effects: [
				{ system: 'JobSystem', modifier: { productivity: 1.1 } },
				{ system: 'MoodSystem', modifier: { overtime_penalty: 0 } },
			],
			conflicts_with: ['trait-loner'],
		},
		'trait-loner': {
			id: 'trait-loner',
			effects: [
				{ system: 'NeedsDecaySystem', modifier: { social_decay: 0 } },
			],
			conflicts_with: ['trait-workaholic'],
		},
	};

	it('builds a modifier map from agent trait IDs', () => {
		const result = resolveTraitModifiers(['trait-resilient'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.get('NeedsDecaySystem')).toEqual({ hunger_decay: 0.5, energy_decay: 0.5 });
		}
	});

	it('merges modifiers from multiple traits targeting the same system', () => {
		const result = resolveTraitModifiers(['trait-resilient', 'trait-loner'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const needsMods = result.value.get('NeedsDecaySystem');
			expect(needsMods).toEqual({ hunger_decay: 0.5, energy_decay: 0.5, social_decay: 0 });
		}
	});

	it('builds modifiers across multiple systems from one trait', () => {
		const result = resolveTraitModifiers(['trait-workaholic'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.get('JobSystem')).toEqual({ productivity: 1.1 });
			expect(result.value.get('MoodSystem')).toEqual({ overtime_penalty: 0 });
			expect(result.value.size).toBe(2);
		}
	});

	it('detects trait conflicts and returns error', () => {
		const result = resolveTraitModifiers(['trait-workaholic', 'trait-loner'], traits);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('TRAIT_CONFLICT');
		}
	});

	it('handles unknown trait IDs gracefully', () => {
		const result = resolveTraitModifiers(['trait-nonexistent'], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.size).toBe(0);
		}
	});

	it('returns empty map for no traits', () => {
		const result = resolveTraitModifiers([], traits);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.size).toBe(0);
		}
	});
});
