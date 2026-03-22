/**
 * journey-checkpoint.test.ts — Tests for the journey checkpoint domain.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	createCheckpoint,
	readCheckpoint,
	updateStepResult,
	pauseForReview,
	resumeFromCheckpoint,
} from "../../../src/domain/tasks/journey-checkpoint.js";
import type { JourneyCheckpoint } from "../../../src/domain/tasks/journey-checkpoint.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();

	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string, _enc?: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string, _enc?: string) => { store[p] = c; }),
			mkdirSync: vi.fn((p: string, _opts?: unknown) => { dirs.add(p); }),
		} as never,
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		} as never,
		_store: store,
	};
}

function makeClock(iso = "2026-03-21T00:00:00.000Z") {
	return { iso: () => iso };
}

const BASE_CHECKPOINT: JourneyCheckpoint = {
	journeyId: "journey-001",
	taskId: "task-001",
	currentStep: 0,
	totalSteps: 3,
	status: "running",
	stepResults: [],
};

// ── Tests ──────────────────────────────────────────────────────────────

describe("journey-checkpoint", () => {
	describe("createCheckpoint", () => {
		it("writes checkpoint JSON to correct path", () => {
			const deps = makeDeps();
			createCheckpoint(deps, "/vault", BASE_CHECKPOINT);

			expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001",
				{ recursive: true },
			);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001/journey-checkpoint.json",
				expect.stringContaining('"journeyId": "journey-001"'),
				"utf-8",
			);
		});

		it("serialises all checkpoint fields", () => {
			const deps = makeDeps();
			createCheckpoint(deps, "/vault", BASE_CHECKPOINT);
			const written = deps._store["/vault/.flowti/var/staging/task-001/journey-checkpoint.json"];
			const parsed = JSON.parse(written) as JourneyCheckpoint;
			expect(parsed.journeyId).toBe("journey-001");
			expect(parsed.taskId).toBe("task-001");
			expect(parsed.totalSteps).toBe(3);
			expect(parsed.status).toBe("running");
			expect(parsed.stepResults).toHaveLength(0);
		});
	});

	describe("readCheckpoint", () => {
		it("returns null for a missing checkpoint", () => {
			const deps = makeDeps();
			expect(readCheckpoint(deps, "/vault", "no-such-task")).toBeNull();
		});

		it("parses an existing checkpoint", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/journey-checkpoint.json":
					JSON.stringify(BASE_CHECKPOINT),
			});
			const result = readCheckpoint(deps, "/vault", "task-001");
			expect(result).not.toBeNull();
			expect(result?.journeyId).toBe("journey-001");
			expect(result?.status).toBe("running");
		});

		it("returns null when checkpoint JSON is malformed", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/journey-checkpoint.json": "not-valid-json{{{",
			});
			expect(readCheckpoint(deps, "/vault", "task-001")).toBeNull();
		});
	});

	describe("updateStepResult", () => {
		it("appends a new step result", () => {
			const clock = makeClock();
			const updated = updateStepResult(BASE_CHECKPOINT, 1, "completed", clock);
			expect(updated.stepResults).toHaveLength(1);
			expect(updated.stepResults[0]).toEqual({ step: 1, status: "completed", at: "2026-03-21T00:00:00.000Z" });
		});

		it("advances currentStep to the updated step", () => {
			const clock = makeClock();
			const updated = updateStepResult(BASE_CHECKPOINT, 2, "completed", clock);
			expect(updated.currentStep).toBe(2);
		});

		it("replaces an existing step result with the same step number", () => {
			const clock = makeClock("2026-03-21T01:00:00.000Z");
			const withFirst = updateStepResult(BASE_CHECKPOINT, 1, "awaiting-review", makeClock());
			const updated = updateStepResult(withFirst, 1, "completed", clock);
			expect(updated.stepResults).toHaveLength(1);
			expect(updated.stepResults[0].status).toBe("completed");
			expect(updated.stepResults[0].at).toBe("2026-03-21T01:00:00.000Z");
		});

		it("does not mutate the original checkpoint", () => {
			const clock = makeClock();
			updateStepResult(BASE_CHECKPOINT, 1, "completed", clock);
			expect(BASE_CHECKPOINT.stepResults).toHaveLength(0);
		});
	});

	describe("pauseForReview", () => {
		it("sets status to paused-for-review", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 2, clock);
			expect(paused.status).toBe("paused-for-review");
		});

		it("adds an awaiting-review step result", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 2, clock);
			expect(paused.stepResults).toHaveLength(1);
			expect(paused.stepResults[0]).toEqual({ step: 2, status: "awaiting-review", at: "2026-03-21T00:00:00.000Z" });
		});

		it("advances currentStep to the paused step", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 2, clock);
			expect(paused.currentStep).toBe(2);
		});

		it("does not mutate the original checkpoint", () => {
			const clock = makeClock();
			pauseForReview(BASE_CHECKPOINT, 2, clock);
			expect(BASE_CHECKPOINT.status).toBe("running");
		});
	});

	describe("resumeFromCheckpoint", () => {
		it("sets status back to running", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 1, clock);
			const resumed = resumeFromCheckpoint(paused);
			expect(resumed.status).toBe("running");
		});

		it("preserves all other fields when resuming", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 1, clock);
			const resumed = resumeFromCheckpoint(paused);
			expect(resumed.journeyId).toBe(paused.journeyId);
			expect(resumed.taskId).toBe(paused.taskId);
			expect(resumed.currentStep).toBe(paused.currentStep);
			expect(resumed.stepResults).toHaveLength(paused.stepResults.length);
		});

		it("does not mutate the paused checkpoint", () => {
			const clock = makeClock();
			const paused = pauseForReview(BASE_CHECKPOINT, 1, clock);
			resumeFromCheckpoint(paused);
			expect(paused.status).toBe("paused-for-review");
		});
	});
});
