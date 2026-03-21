// src/domain/economy/leveling.ts

export interface LevelEntry {
	readonly level: number;
	readonly xpRequired: number;
	readonly title: string;
	readonly unlocks: readonly string[];
}

export const LEVEL_TABLE: readonly LevelEntry[] = [
	{ level: 1, xpRequired: 0,    title: "Novice",      unlocks: ["vault-read", "simple-tasks"] },
	{ level: 2, xpRequired: 100,  title: "Apprentice",  unlocks: ["standing-orders"] },
	{ level: 3, xpRequired: 300,  title: "Journeyman",  unlocks: ["vault-write", "self-proposed"] },
	{ level: 4, xpRequired: 600,  title: "Artisan",     unlocks: ["delegation", "journey"] },
	{ level: 5, xpRequired: 1000, title: "Senior",      unlocks: ["auto-trust", "higher-token-budget"] },
	{ level: 6, xpRequired: 1500, title: "Expert",      unlocks: ["cross-domain"] },
	{ level: 7, xpRequired: 2200, title: "Master",      unlocks: ["mentoring"] },
	{ level: 8, xpRequired: 3000, title: "Grandmaster",  unlocks: ["full-autonomy", "economy-influence"] },
];

const CAPABILITY_MIN_LEVEL: Readonly<Record<string, number>> = {
	"vault-read": 1, "simple-tasks": 1,
	"standing-orders": 2,
	"vault-write": 3, "self-proposed": 3,
	"delegation": 4, "journey": 4,
	"auto-trust": 5, "higher-token-budget": 5,
	"cross-domain": 6,
	"mentoring": 7,
	"full-autonomy": 8, "economy-influence": 8,
};

export function levelForXp(xp: number): number {
	let result = 1;
	for (const entry of LEVEL_TABLE) {
		if (xp >= entry.xpRequired) result = entry.level;
	}
	return result;
}

export function xpForLevel(level: number): number {
	return LEVEL_TABLE.find(e => e.level === level)?.xpRequired ?? 0;
}

export function titleForLevel(level: number): string {
	return LEVEL_TABLE.find(e => e.level === level)?.title ?? "Unknown";
}

export function isEligible(level: number, capability: string): boolean {
	const minLevel = CAPABILITY_MIN_LEVEL[capability];
	return minLevel !== undefined && level >= minLevel;
}
