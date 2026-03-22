import { describe, it, expect } from "vitest";
import {
	shouldShowBriefing,
	levelForXp,
	calculateOfflineProgress,
	CYCLE_DURATION_MS,
	MAX_SIMULATION_MS,
	MIN_BRIEFING_MS,
	BASE_XP_PER_TASK,
	BASE_COIN_PER_TASK,
} from "../../../src/game/systems/offline-progress.js";
import type { AgentOfflineInput } from "../../../src/game/systems/offline-progress.js";

// ── Helpers ──────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentOfflineInput> = {}): AgentOfflineInput {
	return {
		name: "Atlas",
		level: 1,
		xp: 0,
		coin: 0,
		assignedTasks: 10,
		avgTasksPerCycle: 2,
		...overrides,
	};
}

// ── shouldShowBriefing ───────────────────────────────────────────────

describe("shouldShowBriefing", () => {
	it("returns false for less than 5 minutes", () => {
		expect(shouldShowBriefing(4 * 60 * 1000)).toBe(false);
		expect(shouldShowBriefing(0)).toBe(false);
	});

	it("returns true for exactly 5 minutes", () => {
		expect(shouldShowBriefing(MIN_BRIEFING_MS)).toBe(true);
	});

	it("returns true for 8+ hours", () => {
		expect(shouldShowBriefing(8 * 60 * 60 * 1000)).toBe(true);
		expect(shouldShowBriefing(24 * 60 * 60 * 1000)).toBe(true);
	});
});

// ── levelForXp ───────────────────────────────────────────────────────

describe("levelForXp", () => {
	it("returns 1 for 0 XP", () => {
		expect(levelForXp(0)).toBe(1);
	});

	it("returns 2 for 100 XP", () => {
		expect(levelForXp(100)).toBe(2);
	});

	it("returns 8 for 3000+ XP", () => {
		expect(levelForXp(3000)).toBe(8);
		expect(levelForXp(9999)).toBe(8);
	});

	it("returns correct level at each threshold boundary", () => {
		expect(levelForXp(99)).toBe(1);
		expect(levelForXp(299)).toBe(2);
		expect(levelForXp(300)).toBe(3);
		expect(levelForXp(600)).toBe(4);
		expect(levelForXp(1000)).toBe(5);
		expect(levelForXp(1500)).toBe(6);
		expect(levelForXp(2200)).toBe(7);
	});
});

// ── calculateOfflineProgress ─────────────────────────────────────────

describe("calculateOfflineProgress", () => {
	it("simulates correct cycle count for 2 hours", () => {
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const agents = [makeAgent()];
		const result = calculateOfflineProgress(twoHoursMs, agents);

		const expectedCycles = Math.floor(twoHoursMs / CYCLE_DURATION_MS);
		expect(expectedCycles).toBe(4);
		expect(result.cyclesSimulated).toBe(expectedCycles);
		expect(result.simulatedMs).toBe(twoHoursMs);
		expect(result.rested).toBe(false);
	});

	it("caps simulation at 8 hours for 24h elapsed", () => {
		const dayMs = 24 * 60 * 60 * 1000;
		const agents = [makeAgent()];
		const result = calculateOfflineProgress(dayMs, agents);

		expect(result.elapsedMs).toBe(dayMs);
		expect(result.simulatedMs).toBeLessThanOrEqual(MAX_SIMULATION_MS);
		expect(result.rested).toBe(true);
	});

	it("calculates XP per agent based on tasks completed", () => {
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const agents = [makeAgent({ avgTasksPerCycle: 2 })];
		const result = calculateOfflineProgress(twoHoursMs, agents);

		const cycles = Math.floor(twoHoursMs / CYCLE_DURATION_MS);
		const expectedTasks = Math.min(2 * cycles, 10);
		expect(result.agentResults[0].tasksCompleted).toBe(expectedTasks);
		expect(result.agentResults[0].xpEarned).toBe(expectedTasks * BASE_XP_PER_TASK);
		expect(result.agentResults[0].coinEarned).toBe(expectedTasks * BASE_COIN_PER_TASK);
	});

	it("detects level-ups correctly", () => {
		// Agent at level 1 with 80 XP; earning enough to cross 100 threshold
		const agents = [makeAgent({ xp: 80, level: 1, avgTasksPerCycle: 3 })];
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const result = calculateOfflineProgress(twoHoursMs, agents);

		// 4 cycles * 3 tasks = 12 tasks, but capped at 10 assigned
		// 10 * 50 = 500 XP earned → total 580 XP → level 4
		expect(result.agentResults[0].leveledUp).toBe(true);
		expect(result.agentResults[0].previousLevel).toBe(1);
		expect(result.agentResults[0].currentLevel).toBeGreaterThan(1);
	});

	it("sets rested bonus when elapsed > 8 hours", () => {
		const nineHoursMs = 9 * 60 * 60 * 1000;
		const agents = [makeAgent()];
		const result = calculateOfflineProgress(nineHoursMs, agents);

		expect(result.rested).toBe(true);
		expect(result.agentResults[0].needsRestored).toBe(true);
	});

	it("returns 0 tasks for agents with no assigned tasks", () => {
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const agents = [makeAgent({ assignedTasks: 0 })];
		const result = calculateOfflineProgress(twoHoursMs, agents);

		expect(result.agentResults[0].tasksCompleted).toBe(0);
		expect(result.agentResults[0].xpEarned).toBe(0);
		expect(result.agentResults[0].coinEarned).toBe(0);
	});

	it("defaults to 1 task per cycle when avgTasksPerCycle is 0 but has assigned tasks", () => {
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const agents = [makeAgent({ avgTasksPerCycle: 0, assignedTasks: 10 })];
		const result = calculateOfflineProgress(twoHoursMs, agents);

		const cycles = Math.floor(twoHoursMs / CYCLE_DURATION_MS);
		const expectedTasks = Math.min(1 * cycles, 10);
		expect(result.agentResults[0].tasksCompleted).toBe(expectedTasks);
		expect(result.agentResults[0].xpEarned).toBe(expectedTasks * BASE_XP_PER_TASK);
	});
});
