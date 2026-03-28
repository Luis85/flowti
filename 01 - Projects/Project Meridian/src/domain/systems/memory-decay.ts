import type { MemoryEntry, MemoryState } from '../core/component-data.js';

export interface MemoryDecayResult {
	state: MemoryState;
	decayedCount: number;
	prunedCount: number;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

export function applyMemoryDecay(
	state: MemoryState,
	currentTick: number,
	config: { min_lifespan_ticks: number },
): MemoryDecayResult {
	if (state.entries.length === 0) {
		return { state, decayedCount: 0, prunedCount: 0 };
	}

	let decayedCount = 0;
	let prunedCount = 0;

	const decayed: MemoryEntry[] = [];

	for (const entry of state.entries) {
		const age = currentTick - entry.tick;
		if (age < config.min_lifespan_ticks) {
			decayed.push(entry);
			continue;
		}

		const originalSig = entry.original_significance ?? entry.significance;
		const decayAmount = 0.1 / (originalSig / 5);
		const newSignificance = round2(entry.significance - decayAmount);

		if (newSignificance < 1) {
			prunedCount++;
			continue;
		}

		decayed.push({
			...entry,
			significance: newSignificance,
			original_significance: originalSig,
		});
		decayedCount++;
	}

	// Enforce maxEntries — drop lowest-significance if over
	if (decayed.length > state.maxEntries) {
		decayed.sort((a, b) => b.significance - a.significance);
		const excess = decayed.length - state.maxEntries;
		decayed.splice(state.maxEntries, excess);
		prunedCount += excess;
	}

	return {
		state: { entries: decayed, maxEntries: state.maxEntries },
		decayedCount,
		prunedCount,
	};
}
