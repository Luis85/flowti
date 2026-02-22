/**
 * Flow 22: Train Merge Down — Merge-down direction, detail view button, layout
 *
 * Tests the merge-down workflow: branch endpoint auto-detects target
 * on the main chain, addThought + mergeBranch in sequence.
 *
 * Event sequence:
 *   train.started → train.thought.added (×N) → train.branch.merged
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import type { TrainServiceState } from "../../src/domain/train/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

function createTestHarness() {
	const eventBus: IEventBus = new EventBus();
	const fileSystem = createMockFileSystem();
	const { storage } = createMockStorage<TrainServiceState>();

	const captureService = new CaptureService({
		eventBus,
		fileSystem,
		getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
	});

	// Simulate SessionService: session.create → session.created
	eventBus.on("session.create", (event) => {
		const sessionId = `session_mock_${Date.now()}`;
		void eventBus.emit("session.created", {
			session: {
				id: sessionId,
				type: event.payload.type,
				title: event.payload.title,
				status: "prepared",
				durationMinutes: 0,
				createdAt: new Date().toISOString(),
				startedAt: null,
				pausedAt: null,
				elapsedBeforePauseMs: 0,
				completedAt: null,
				artifacts: [],
				notes: "",
				focusFile: null,
				timeline: [],
				goals: [],
				links: [],
				notesFile: null,
				canvasFile: null,
				activity: [],
				activityFilter: [],
				contextBindings: [],
				decisions: [],
				workspaceState: null,
				outputArtifacts: [],
				intent: null,
				energy: null,
				executionTasks: [],
				reflections: [],
				closureResponse: null,
			},
		});
	});

	// Stub session.start/complete/pause/resume — no-ops
	eventBus.on("session.start", () => {});
	eventBus.on("session.complete", () => {});

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

	return { trainService, eventBus, fileSystem };
}

describe("Flow 22: Train Merge Down", () => {
	let trainService: TrainService;
	let eventBus: IEventBus;

	beforeEach(async () => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		eventBus = harness.eventBus;
		await trainService.load();
	});

	// ── findMergeDownTarget ────────────────────────────────────

	describe("findMergeDownTarget integration", () => {
		it("happy path: branch from A → target is B (next main chain node)", async () => {
			// Main: A → B → C, Branch: A → D
			const train = await trainService.startTrain("Merge Down Test");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			await trainService.addThought(train.id, "C");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			const target = trainService.findMergeDownTarget(train.id, d!.id);
			expect(target).toBe(b!.id);
		});

		it("deep branch: A→D→E, target for E is B (next after A)", async () => {
			const train = await trainService.startTrain("Deep Branch");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});
			const e = await trainService.addThought(train.id, "E", {
				direction: "next",
				fromThoughtId: d!.id,
			});

			const target = trainService.findMergeDownTarget(train.id, e!.id);
			expect(target).toBe(b!.id);
		});

		it("branch from head → null (no next after origin)", async () => {
			const train = await trainService.startTrain("Head Branch");
			await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: b!.id,
			});

			const target = trainService.findMergeDownTarget(train.id, d!.id);
			expect(target).toBeNull();
		});

		it("sub-branch: A→D(branch)→F(branch), target for F is B", async () => {
			const train = await trainService.startTrain("Sub Branch");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});
			const f = await trainService.addThought(train.id, "F", {
				direction: "branch",
				fromThoughtId: d!.id,
			});

			const target = trainService.findMergeDownTarget(train.id, f!.id);
			expect(target).toBe(b!.id);
		});
	});

	// ── Merge-down action ────────────────────────────────────

	describe("merge-down action (addThought + mergeBranch)", () => {
		it("creates new thought then merges source back to main chain", async () => {
			const train = await trainService.startTrain("Action Test");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// Simulate merge-down: add thought from D, then merge D into B
			const newThought = await trainService.addThought(train.id, "Conclusion", {
				direction: "next",
				fromThoughtId: d!.id,
			});
			expect(newThought).not.toBeNull();

			const mergeResult = await trainService.mergeBranch(train.id, d!.id, b!.id);
			expect(mergeResult).toBe(true);

			// Verify merge relation exists
			const merges = trainService.getMerges(train.id);
			expect(merges).toHaveLength(1);
			expect(merges[0].fromId).toBe(d!.id);
			expect(merges[0].toId).toBe(b!.id);
		});

		it("emits train.branch.merged event", async () => {
			const mergeEvents: Array<{ sourceId: string; targetId: string }> = [];
			eventBus.on("train.branch.merged", (e) => { mergeEvents.push(e.payload); });

			const train = await trainService.startTrain("Event Test");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			await trainService.addThought(train.id, "Wrap-up", {
				direction: "next",
				fromThoughtId: d!.id,
			});
			await trainService.mergeBranch(train.id, d!.id, b!.id);

			expect(mergeEvents).toHaveLength(1);
			expect(mergeEvents[0].sourceId).toBe(d!.id);
			expect(mergeEvents[0].targetId).toBe(b!.id);
		});

		it("main chain is preserved after merge-down", async () => {
			const train = await trainService.startTrain("Chain Test");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const c = await trainService.addThought(train.id, "C");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			await trainService.addThought(train.id, "Merged Result", {
				direction: "next",
				fromThoughtId: d!.id,
			});
			await trainService.mergeBranch(train.id, d!.id, b!.id);

			// Main chain should still be A → B → C
			const timeline = trainService.getTimeline(train.id);
			expect(timeline.map((t) => t.title)).toEqual(["A", "B", "C"]);
		});

		it("state persisted after merge-down", async () => {
			const train = await trainService.startTrain("Persist Test");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			await trainService.addThought(train.id, "Conclusion", {
				direction: "next",
				fromThoughtId: d!.id,
			});
			await trainService.mergeBranch(train.id, d!.id, b!.id);

			// Re-read state: train should have 4 thoughts and 1 merge
			const reloaded = trainService.getTrain(train.id)!;
			expect(reloaded.thoughts).toHaveLength(4);
			expect(reloaded.relations.filter((r) => r.direction === "merge")).toHaveLength(1);
		});
	});

	// ── Multiple branches ────────────────────────────────────

	describe("multiple branches", () => {
		it("two branches merge down independently to same target", async () => {
			const train = await trainService.startTrain("Multi Branch");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");

			// Branch 1: A → D
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});
			// Branch 2: A → E
			const e = await trainService.addThought(train.id, "E", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// Both should target B
			expect(trainService.findMergeDownTarget(train.id, d!.id)).toBe(b!.id);
			expect(trainService.findMergeDownTarget(train.id, e!.id)).toBe(b!.id);

			// Merge both
			await trainService.mergeBranch(train.id, d!.id, b!.id);
			await trainService.mergeBranch(train.id, e!.id, b!.id);

			expect(trainService.getMerges(train.id)).toHaveLength(2);
		});
	});

	// ── Event sequencing ─────────────────────────────────────

	describe("event sequencing", () => {
		it("thought.added fires before branch.merged", async () => {
			const sequence: string[] = [];
			eventBus.on("train.thought.added", () => { sequence.push("thought.added"); });
			eventBus.on("train.branch.merged", () => { sequence.push("branch.merged"); });

			const train = await trainService.startTrain("Sequence");
			const a = await trainService.addThought(train.id, "A");
			const b = await trainService.addThought(train.id, "B");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// Clear sequence to only capture the merge-down action
			sequence.length = 0;

			// Simulate merge-down: add thought, then merge
			await trainService.addThought(train.id, "Result", {
				direction: "next",
				fromThoughtId: d!.id,
			});
			await trainService.mergeBranch(train.id, d!.id, b!.id);

			expect(sequence).toEqual(["thought.added", "branch.merged"]);
		});
	});

	// ── findMergeDownTarget after main chain extends ─────────

	describe("target changes as main chain grows", () => {
		it("returns valid target after main chain extends past origin", async () => {
			const train = await trainService.startTrain("Growing");
			const a = await trainService.addThought(train.id, "A");
			const d = await trainService.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// No "next" after A yet → target should be null
			expect(trainService.findMergeDownTarget(train.id, d!.id)).toBeNull();

			// Extend main chain: A → B
			const b = await trainService.addThought(train.id, "B", {
				direction: "next",
				fromThoughtId: a!.id,
			});

			// Now target should be B
			expect(trainService.findMergeDownTarget(train.id, d!.id)).toBe(b!.id);
		});
	});
});
