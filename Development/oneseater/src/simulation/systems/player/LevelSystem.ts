
export type PlayerProgress = {
	level: number;
	currentXP: number;
	nextLevelXP: number;
	progress: number;
};

// XP required for each level (cumulative) needs to be put into a system later down the road
export const LEVEL_XP_THRESHOLDS = [
	0, // Level 1: 0 XP
	100, // Level 2: 100 XP
	300, // Level 3: 300 XP
	600, // Level 4: 600 XP
	1000, // Level 5: 1000 XP
	1500, // Level 6: 1500 XP
	2200, // Level 7: 2200 XP
	3000, // Level 8: 3000 XP
	4000, // Level 9: 4000 XP
	5200, // Level 10: 5200 XP
	6600, // Level 11
	8200, // Level 12
	10000, // Level 13
	12000, // Level 14
	14500, // Level 15
	17500, // Level 16
	21000, // Level 17
	25000, // Level 18
	30000, // Level 19
	36000, // Level 20
];

export function getLevelFromXP(totalXP: number): PlayerProgress {
	let level = 1;
	for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
		if (totalXP >= LEVEL_XP_THRESHOLDS[i]) {
			level = i + 1;
		} else {
			break;
		}
	}

	const currentThreshold = LEVEL_XP_THRESHOLDS[level - 1] || 0;
	const nextThreshold =
		LEVEL_XP_THRESHOLDS[level] ||
		LEVEL_XP_THRESHOLDS[LEVEL_XP_THRESHOLDS.length - 1];
	const xpInLevel = totalXP - currentThreshold;
	const xpNeeded = nextThreshold - currentThreshold;
	const progress = xpNeeded > 0 ? (xpInLevel / xpNeeded) * 100 : 100;

	return {
		level,
		currentXP: xpInLevel,
		nextLevelXP: xpNeeded,
		progress: Math.min(100, Math.max(0, progress)),
	};
}
