export interface GameRNG {
	next(): number;
	range(min: number, max: number): number;
	chance(probability: number): boolean;
}

/** Mulberry32 — fast 32-bit seeded PRNG. */
export function createGameRNG(seed: number): GameRNG {
	let state = seed | 0;

	function next(): number {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	return {
		next,
		range(min: number, max: number): number {
			return min + next() * (max - min);
		},
		chance(probability: number): boolean {
			if (probability <= 0) return false;
			if (probability >= 1) return true;
			return next() < probability;
		},
	};
}

/** Hash a string to a 32-bit integer for RNG seeding. */
export function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash;
}
