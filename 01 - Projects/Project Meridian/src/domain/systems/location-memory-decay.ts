import type { LocationMemoryEntry } from '../../infrastructure/entity/bt-working-memory.js';

export interface LocationMemoryConfig {
	usable_threshold: number;
	decay_per_tick: number;
	visited: { significance: number; min_lifespan_ticks: number };
	perceived: { significance: number; min_lifespan_ticks: number };
	gossip: { significance_multiplier: number; min_lifespan_ticks: number };
}

export interface LocationMemoryDecayResult {
	entries: LocationMemoryEntry[];
	decayedCount: number;
	prunedCount: number;
}

function getMinLifespan(source: LocationMemoryEntry['source'], config: LocationMemoryConfig): number {
	switch (source) {
		case 'visited': return config.visited.min_lifespan_ticks;
		case 'perceived': return config.perceived.min_lifespan_ticks;
		case 'gossip': return config.gossip.min_lifespan_ticks;
	}
}

export function applyLocationMemoryDecay(
	entries: LocationMemoryEntry[],
	currentTick: number,
	config: LocationMemoryConfig,
): LocationMemoryDecayResult {
	if (entries.length === 0) {
		return { entries: [], decayedCount: 0, prunedCount: 0 };
	}

	let decayedCount = 0;
	let prunedCount = 0;
	const result: LocationMemoryEntry[] = [];

	for (const entry of entries) {
		const minLifespan = getMinLifespan(entry.source, config);
		const age = currentTick - entry.lastRefreshedTick;

		if (age <= minLifespan) {
			result.push(entry);
			continue;
		}

		const newSignificance = entry.significance - config.decay_per_tick;
		if (newSignificance < config.usable_threshold) {
			prunedCount++;
			continue;
		}

		result.push({ ...entry, significance: newSignificance });
		decayedCount++;
	}

	return { entries: result, decayedCount, prunedCount };
}
