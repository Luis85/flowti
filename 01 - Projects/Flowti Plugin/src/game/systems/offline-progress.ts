/**
 * offline-progress.ts — Simulates agent progress while the user is away.
 *
 * Pure calculation functions with no side effects.
 * Caps simulation at 8 hours, tracks XP/coin earned, level-ups,
 * and rest status per agent.
 */

// ── Constants ────────────────────────────────────────────────────────

export const CYCLE_DURATION_MS = 25 * 60 * 1000;
export const MAX_SIMULATION_MS = 8 * 60 * 60 * 1000;
export const MIN_BRIEFING_MS = 5 * 60 * 1000;
export const BASE_XP_PER_TASK = 50;
export const BASE_COIN_PER_TASK = 25;
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000] as const;

// ── Types ────────────────────────────────────────────────────────────

export interface AgentOfflineInput {
	readonly name: string;
	readonly level: number;
	readonly xp: number;
	readonly coin: number;
	readonly assignedTasks: number;
	readonly avgTasksPerCycle: number;
}

export interface AgentOfflineResult {
	readonly name: string;
	readonly tasksCompleted: number;
	readonly xpEarned: number;
	readonly coinEarned: number;
	readonly leveledUp: boolean;
	readonly previousLevel: number;
	readonly currentLevel: number;
	readonly needsRestored: boolean;
}

export interface OfflineResults {
	readonly elapsedMs: number;
	readonly simulatedMs: number;
	readonly cyclesSimulated: number;
	readonly agentResults: readonly AgentOfflineResult[];
	readonly rested: boolean;
}

// ── Functions ────────────────────────────────────────────────────────

export function shouldShowBriefing(elapsedMs: number): boolean {
	return elapsedMs >= MIN_BRIEFING_MS;
}

export function levelForXp(xp: number): number {
	for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
		if (xp >= LEVEL_THRESHOLDS[i]) {
			return i + 1;
		}
	}
	return 1;
}

export function calculateOfflineProgress(
	elapsedMs: number,
	agents: readonly AgentOfflineInput[],
): OfflineResults {
	const simulatedMs = Math.min(elapsedMs, MAX_SIMULATION_MS);
	const cyclesSimulated = Math.floor(simulatedMs / CYCLE_DURATION_MS);
	const rested = elapsedMs > MAX_SIMULATION_MS;

	const agentResults: AgentOfflineResult[] = agents.map((agent) => {
		const effectiveRate =
			agent.avgTasksPerCycle === 0 && agent.assignedTasks > 0
				? 1
				: agent.avgTasksPerCycle;

		const tasksCompleted = Math.min(
			Math.floor(effectiveRate * cyclesSimulated),
			agent.assignedTasks,
		);

		const xpEarned = tasksCompleted * BASE_XP_PER_TASK;
		const coinEarned = tasksCompleted * BASE_COIN_PER_TASK;
		const currentLevel = levelForXp(agent.xp + xpEarned);
		const leveledUp = currentLevel > agent.level;

		return {
			name: agent.name,
			tasksCompleted,
			xpEarned,
			coinEarned,
			leveledUp,
			previousLevel: agent.level,
			currentLevel,
			needsRestored: rested,
		};
	});

	return {
		elapsedMs,
		simulatedMs,
		cyclesSimulated,
		agentResults,
		rested,
	};
}
