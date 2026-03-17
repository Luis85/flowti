
export type PlayerStatus = "active" | "sleeping" | "idle" | "exhausted";

export function defaultPlayer(): PlayerState {
	return {
		id: "player-1",
		name: "Player",
		status: "idle",
		stats: {
			energy: 100,
			xp: 0,
			completedTasks: 0,
			timeSpentMinutes: 0,
			exhaustedSleepStacks: 0,
		},
		sleepStartedAt: undefined,
	};
}

export type PlayerState = {
	id: string;
	name: string;
	status: PlayerStatus;
	sleepStartedAt?: number; // simNowMs
	stats: PlayerStatistics;
};

export type PlayerStatistics = {
	energy: number; // 0..100
	xp: number;
	completedTasks: number;
	timeSpentMinutes: number;
	exhaustedSleepStacks: number;
};

export type PlayerEnergyTuning = {
	// Baseline drain per SIM day if player does nothing
	baselineDrainPerDay: number; // e.g. 12 => ~12 energy/day

	// How much more drain at night / late hours
	nightMultiplier: number; // e.g. 1.4
	workMultiplier: number; // e.g. 1.0
	morningMultiplier: number; // e.g. 0.9

	// Curve smoothing (optional)
	minPerMinuteDrain: number; // floor
	maxPerMinuteDrain: number; // cap

	// Endurance effects
	enduranceMitigationPerPoint: number; // e.g. 0.003 (=0.3% per endurance point)
};

export const PLAYER_MAX_ENERGY = 100;
export const PLAYER_MIN_ENERGY = 0;
