import { describe, it, expect } from 'vitest';
import { applyNeedsDecay } from '../../../src/domain/systems/needs-decay.js';
import type { NeedsState } from '../../../src/domain/core/component-data.js';

function makeInput(overrides: Partial<{ state: Partial<NeedsState>; ht: number; chr: number }> = {}) {
	return {
		state: { hunger: 80, energy: 90, social: 70, ...overrides.state },
		hungerAttribute: overrides.ht ?? 10,
		energyAttribute: overrides.ht ?? 10,
		socialAttribute: overrides.chr ?? 10,
		modifiers: null,
	};
}

const defaultConfig = { hunger_decay: 0.5, energy_decay: 0.25, social_decay: 0.15 };

describe('applyNeedsDecay', () => {
	it('decays all three needs with default attributes (HT=10, Chr=10)', () => {
		const result = applyNeedsDecay(makeInput(), defaultConfig);
		expect(result.state.hunger).toBe(79.5);
		expect(result.state.energy).toBe(89.75);
		expect(result.state.social).toBe(69.85);
	});

	it('scales decay inversely with attribute (HT=20 → half decay)', () => {
		const result = applyNeedsDecay(makeInput({ ht: 20 }), defaultConfig);
		expect(result.state.hunger).toBe(79.75);
	});

	it('applies trait modifier scale to decay rate', () => {
		const input = { ...makeInput(), modifiers: { hungerDecayScale: 2.0 } };
		const result = applyNeedsDecay(input, defaultConfig);
		expect(result.state.hunger).toBe(79);
	});

	it('emits NeedCritical when hunger crosses below 20', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 20 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'hunger');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(20);
		expect(critical?.value).toBe(critical?.newValue);
	});

	it('emits NeedCritical when energy crosses below 15', () => {
		const result = applyNeedsDecay(makeInput({ state: { energy: 15 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'energy');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(15);
	});

	it('emits NeedCritical when social crosses below 25', () => {
		const result = applyNeedsDecay(makeInput({ state: { social: 25 } }), defaultConfig);
		const critical = result.events.find(e => e.type === 'NeedCritical' && e.need === 'social');
		expect(critical).toBeDefined();
		expect(critical?.threshold).toBe(25);
	});

	it('does not re-emit NeedCritical when already below threshold', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 10 } }), defaultConfig);
		const critical = result.events.filter(e => e.type === 'NeedCritical' && e.need === 'hunger');
		expect(critical).toHaveLength(0);
	});

	it('emits AgentExhausted when energy reaches 0', () => {
		const result = applyNeedsDecay(makeInput({ state: { energy: 0.1 } }), defaultConfig);
		const exhausted = result.events.find(e => e.type === 'AgentExhausted');
		expect(exhausted).toBeDefined();
	});

	it('does not emit NeedCritical when energy reaches exactly 0', () => {
		const result = applyNeedsDecay(makeInput({ state: { energy: 0.1 } }), defaultConfig);
		const critical = result.events.filter(e => e.type === 'NeedCritical' && e.need === 'energy');
		expect(critical).toHaveLength(0);
	});

	it('clamps values to [0, 100]', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 0.1 } }), defaultConfig);
		expect(result.state.hunger).toBe(0);
	});

	it('does not decay below 0', () => {
		const result = applyNeedsDecay(makeInput({ state: { hunger: 0 } }), defaultConfig);
		expect(result.state.hunger).toBe(0);
	});

	it('always emits NeedChanged for each need that changes', () => {
		const result = applyNeedsDecay(makeInput(), defaultConfig);
		const changed = result.events.filter(e => e.type === 'NeedChanged');
		expect(changed).toHaveLength(3);
	});

	it('does not emit NeedChanged when value is already 0', () => {
		const result = applyNeedsDecay(
			makeInput({ state: { hunger: 0, energy: 0, social: 0 } }),
			defaultConfig,
		);
		const changed = result.events.filter(e => e.type === 'NeedChanged');
		expect(changed).toHaveLength(0);
	});
});
