import { describe, it, expect } from 'vitest';
import { applyLocationMemoryDecay } from '../../../src/domain/systems/location-memory-decay.js';
import type { LocationMemoryEntry } from '../../../src/infrastructure/entity/bt-working-memory.js';

function makeEntry(overrides: Partial<LocationMemoryEntry> = {}): LocationMemoryEntry {
	return {
		locationId: 'loc-test',
		facilityType: 'rest_inn',
		position: { x: 100, y: 200 },
		significance: 50,
		originalSignificance: 50,
		source: 'visited',
		reliability: 1.0,
		discoveredTick: 0,
		lastRefreshedTick: 0,
		...overrides,
	};
}

const defaultConfig = {
	usable_threshold: 5,
	decay_per_tick: 0.025,
	visited: { significance: 50, min_lifespan_ticks: 960 },
	perceived: { significance: 25, min_lifespan_ticks: 480 },
	gossip: { significance_multiplier: 20, min_lifespan_ticks: 480 },
};

describe('applyLocationMemoryDecay', () => {
	it('does not decay entries within min_lifespan', () => {
		const entry = makeEntry({ lastRefreshedTick: 100 });
		const result = applyLocationMemoryDecay([entry], 500, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBe(50);
	});

	it('decays entries past min_lifespan at configured rate', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const result = applyLocationMemoryDecay([entry], 961, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBeLessThan(50);
		expect(result.entries[0]!.significance).toBeCloseTo(50 - 0.025, 5);
	});

	it('prunes entries below usable_threshold', () => {
		const entry = makeEntry({ significance: 5.01, lastRefreshedTick: 0 });
		const result = applyLocationMemoryDecay([entry], 961, defaultConfig);
		expect(result.entries).toHaveLength(0);
		expect(result.prunedCount).toBe(1);
	});

	it('uses source-specific min_lifespan for perceived', () => {
		const entry = makeEntry({ source: 'perceived', significance: 25, originalSignificance: 25, lastRefreshedTick: 0 });
		// At tick 480, still within perceived min_lifespan (480)
		const noDecay = applyLocationMemoryDecay([entry], 480, defaultConfig);
		expect(noDecay.entries[0]!.significance).toBe(25);
		// At tick 481, past min_lifespan — decay should apply
		const decayed = applyLocationMemoryDecay([entry], 481, defaultConfig);
		expect(decayed.entries[0]!.significance).toBeLessThan(25);
	});

	it('uses source-specific min_lifespan for gossip', () => {
		const entry = makeEntry({ source: 'gossip', significance: 15, originalSignificance: 15, reliability: 0.75, lastRefreshedTick: 0 });
		const noDecay = applyLocationMemoryDecay([entry], 480, defaultConfig);
		expect(noDecay.entries[0]!.significance).toBe(15);
		const decayed = applyLocationMemoryDecay([entry], 481, defaultConfig);
		expect(decayed.entries[0]!.significance).toBeLessThan(15);
	});

	it('returns empty array for empty input', () => {
		const result = applyLocationMemoryDecay([], 100, defaultConfig);
		expect(result.entries).toHaveLength(0);
		expect(result.decayedCount).toBe(0);
		expect(result.prunedCount).toBe(0);
	});

	it('visited entry survives ~2760 ticks of decay', () => {
		let entry = makeEntry({ lastRefreshedTick: 0 });
		// Simulate 2760 ticks of decay
		for (let tick = 1; tick <= 2760; tick++) {
			const result = applyLocationMemoryDecay([entry], tick, defaultConfig);
			if (result.entries.length === 0) {
				// Entry pruned before expected — fail
				expect(tick).toBeGreaterThan(2700);
				return;
			}
			entry = result.entries[0]!;
		}
		// Should be very close to threshold by now
		expect(entry.significance).toBeLessThan(10);
	});

	it('retains entry with significance exactly at usable_threshold', () => {
		const entry = makeEntry({ significance: 5.0, lastRefreshedTick: 0 });
		// At tick 960 (within min_lifespan), no decay — entry kept
		const result = applyLocationMemoryDecay([entry], 960, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBe(5.0);
	});

	it('decays mixed-source entries independently', () => {
		const visited = makeEntry({ source: 'visited', significance: 50, lastRefreshedTick: 0 });
		const perceived = makeEntry({ locationId: 'loc-perceived', source: 'perceived', significance: 25, originalSignificance: 25, lastRefreshedTick: 0 });
		const gossip = makeEntry({ locationId: 'loc-gossip', source: 'gossip', significance: 15, originalSignificance: 15, reliability: 0.75, lastRefreshedTick: 0 });

		// At tick 500: visited within lifespan (960), perceived/gossip past lifespan (480)
		const result = applyLocationMemoryDecay([visited, perceived, gossip], 500, defaultConfig);
		expect(result.entries).toHaveLength(3);
		expect(result.entries[0]!.significance).toBe(50); // visited: no decay
		expect(result.entries[1]!.significance).toBeLessThan(25); // perceived: decayed
		expect(result.entries[2]!.significance).toBeLessThan(15); // gossip: decayed
		expect(result.decayedCount).toBe(2);
	});

	it('entry refreshed mid-decay stops decaying for another min_lifespan', () => {
		// Simulate: entry created at tick 0, refreshed at tick 1000
		const entry = makeEntry({ significance: 40, lastRefreshedTick: 1000 });
		// At tick 1960 (960 past refresh), still within min_lifespan — no decay
		const noDecay = applyLocationMemoryDecay([entry], 1960, defaultConfig);
		expect(noDecay.entries[0]!.significance).toBe(40);
		// At tick 1961, past min_lifespan — should decay
		const decayed = applyLocationMemoryDecay([entry], 1961, defaultConfig);
		expect(decayed.entries[0]!.significance).toBeLessThan(40);
	});

	it('does not decay when lastRefreshedTick exceeds currentTick', () => {
		const entry = makeEntry({ lastRefreshedTick: 500 });
		const result = applyLocationMemoryDecay([entry], 100, defaultConfig);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.significance).toBe(50);
		expect(result.decayedCount).toBe(0);
	});
});
