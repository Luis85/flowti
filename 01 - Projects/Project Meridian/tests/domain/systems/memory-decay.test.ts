import { describe, it, expect } from 'vitest';
import { applyMemoryDecay } from '../../../src/domain/systems/memory-decay.js';
import type { MemoryEntry, MemoryState } from '../../../src/domain/core/component-data.js';

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
	return {
		tick: 0,
		type: 'test',
		description: 'test event',
		participants: [],
		outcome: 'neutral',
		significance: 5,
		mood_impact: 0,
		...overrides,
	};
}

function makeState(entries: MemoryEntry[], maxEntries = 50): MemoryState {
	return { entries, maxEntries };
}

const defaultConfig = { min_lifespan_ticks: 20 };

describe('applyMemoryDecay', () => {
	it('does not decay entries within min lifespan', () => {
		const entry = makeEntry({ tick: 90, significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 100, defaultConfig);
		expect(result.state.entries[0]?.significance).toBe(5);
		expect(result.decayedCount).toBe(0);
	});

	it('decays entries past min lifespan', () => {
		const entry = makeEntry({ tick: 0, significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries[0]?.significance).toBeCloseTo(4.9, 2);
		expect(result.decayedCount).toBe(1);
	});

	it('sets original_significance on first decay', () => {
		const entry = makeEntry({ tick: 0, significance: 8 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries[0]?.original_significance).toBe(8);
	});

	it('uses original_significance for subsequent decays', () => {
		const entry = makeEntry({ tick: 0, significance: 4.9, original_significance: 5 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries[0]?.significance).toBeCloseTo(4.8, 2);
	});

	it('high-significance entries decay slower', () => {
		const highSig = makeEntry({ tick: 0, significance: 10 });
		const lowSig = makeEntry({ tick: 0, significance: 2 });
		const highResult = applyMemoryDecay(makeState([highSig]), 25, defaultConfig);
		const lowResult = applyMemoryDecay(makeState([lowSig]), 25, defaultConfig);
		expect(highResult.state.entries[0]?.significance).toBeCloseTo(9.95, 2);
		expect(lowResult.state.entries[0]?.significance).toBeCloseTo(1.75, 2);
	});

	it('prunes entries with significance < 1', () => {
		const entry = makeEntry({ tick: 0, significance: 0.5, original_significance: 1 });
		const result = applyMemoryDecay(makeState([entry]), 25, defaultConfig);
		expect(result.state.entries).toHaveLength(0);
		expect(result.prunedCount).toBe(1);
	});

	it('empty memory state is a no-op', () => {
		const result = applyMemoryDecay(makeState([]), 100, defaultConfig);
		expect(result.state.entries).toHaveLength(0);
		expect(result.decayedCount).toBe(0);
		expect(result.prunedCount).toBe(0);
	});

	it('enforces maxEntries by dropping lowest-significance', () => {
		const entries = [
			makeEntry({ tick: 0, significance: 3, type: 'low' }),
			makeEntry({ tick: 0, significance: 8, type: 'high' }),
			makeEntry({ tick: 0, significance: 5, type: 'mid' }),
		];
		const result = applyMemoryDecay(makeState(entries, 2), 25, defaultConfig);
		expect(result.state.entries).toHaveLength(2);
		expect(result.state.entries.find(e => e.type === 'low')).toBeUndefined();
	});
});
