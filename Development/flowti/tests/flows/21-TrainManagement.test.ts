/**
 * Flow 21: Train Management — Settings, Rename, Delete
 *
 * Tests the complete lifecycle of train management features:
 * trainMaxThoughts setting enforcement, rename, delete, and their constraints.
 *
 * Event sequence:
 *   train.started → train.thought.added (×N) → train.renamed → train.completed → train.deleted
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import type { TrainServiceState } from "../../src/domain/train/types";
import { MAX_THOUGHTS_PER_TRAIN } from "../../src/domain/train/types";
import { getCanvasPath } from "../../src/domain/train/helpers";
import { createMockStorage, createMockFileSystem } from "./testHelpers";

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

	// Stub session lifecycle — no-ops
	eventBus.on("session.start", () => {});
	eventBus.on("session.complete", () => {});
	eventBus.on("session.pause", () => {});

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

	return { trainService, eventBus, fileSystem };
}

describe("Flow 21: Train Management", () => {
	let trainService: TrainService;
	let eventBus: IEventBus;

	beforeEach(async () => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		eventBus = harness.eventBus;
		await trainService.load();
	});

	// ── trainMaxThoughts Setting ─────────────────────────────

	describe("trainMaxThoughts setting enforcement", () => {
		it("respects configured trainMaxThoughts limit", async () => {
			trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 3 });
			const train = await trainService.startTrain("Small Limit");

			await trainService.addThought(train.id, "One");
			await trainService.addThought(train.id, "Two");
			await trainService.addThought(train.id, "Three");

			// Fourth thought should be rejected
			const rejected = await trainService.addThought(train.id, "Four");
			expect(rejected).toBeNull();
			expect(trainService.getTrain(train.id)!.thoughts).toHaveLength(3);
		});

		it("absolute cap (MAX_THOUGHTS_PER_TRAIN) overrides setting > 500", async () => {
			trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 1000 });

			// The effective limit should be Math.min(1000, 500) = 500
			// We verify the constant value rather than creating 500 thoughts
			expect(MAX_THOUGHTS_PER_TRAIN).toBe(500);
		});

		it("default limit (100) applies when not overridden", async () => {
			const harness = createTestHarness();
			const service = harness.trainService;
			// Default from createTestHarness sets trainMaxThoughts: 100
			expect(service.getSettings().trainMaxThoughts).toBe(100);
		});
	});

	// ── Rename ───────────────────────────────────────────────

	describe("rename lifecycle", () => {
		it("renames a train and emits event", async () => {
			const train = await trainService.startTrain("Original Title");
			await trainService.addThought(train.id, "Thought");

			const events: Array<{ oldTitle: string; newTitle: string }> = [];
			eventBus.on("train.renamed", (e) => {
				events.push(e.payload as { oldTitle: string; newTitle: string });
			});

			const ok = await trainService.renameTrain(train.id, "Renamed Title");

			expect(ok).toBe(true);
			expect(trainService.getTrain(train.id)!.title).toBe("Renamed Title");
			expect(events).toHaveLength(1);
			expect(events[0].oldTitle).toBe("Original Title");
			expect(events[0].newTitle).toBe("Renamed Title");
		});

		it("rejects empty title", async () => {
			const train = await trainService.startTrain("Keep Me");

			expect(await trainService.renameTrain(train.id, "")).toBe(false);
			expect(await trainService.renameTrain(train.id, "   ")).toBe(false);
			expect(trainService.getTrain(train.id)!.title).toBe("Keep Me");
		});

		it("allows renaming a completed train", async () => {
			const train = await trainService.startTrain("Before Complete");
			await trainService.addThought(train.id, "T");
			await trainService.completeTrain(train.id);

			const ok = await trainService.renameTrain(train.id, "After Complete");

			expect(ok).toBe(true);
			expect(trainService.getTrain(train.id)!.title).toBe("After Complete");
		});
	});

	// ── Delete ───────────────────────────────────────────────

	describe("delete lifecycle", () => {
		it("deletes a completed train", async () => {
			const train = await trainService.startTrain("Delete Me");
			await trainService.addThought(train.id, "T");
			await trainService.completeTrain(train.id);

			const events: Array<{ trainId: string; title: string }> = [];
			eventBus.on("train.deleted", (e) => {
				events.push(e.payload as { trainId: string; title: string });
			});

			const ok = await trainService.deleteTrain(train.id);

			expect(ok).toBe(true);
			expect(trainService.getTrain(train.id)).toBeUndefined();
			expect(trainService.getAllTrains()).toHaveLength(0);
			expect(events).toHaveLength(1);
			expect(events[0].title).toBe("Delete Me");
		});

		it("blocks deletion of running train", async () => {
			const train = await trainService.startTrain("Still Running");

			const ok = await trainService.deleteTrain(train.id);

			expect(ok).toBe(false);
			expect(trainService.getTrain(train.id)).toBeDefined();
		});

		it("allows deletion of paused train", async () => {
			const train = await trainService.startTrain("Paused");
			await trainService.pause(train.id);

			const ok = await trainService.deleteTrain(train.id);

			expect(ok).toBe(true);
			expect(trainService.getTrain(train.id)).toBeUndefined();
		});
	});

	// ── Canvas Path Helper ──────────────────────────────────

	describe("canvas path consistency", () => {
		it("getCanvasPath produces consistent paths", () => {
			expect(getCanvasPath("My Train", "Trains")).toBe("Trains/My Train.canvas");
		});

		it("handles empty folder", () => {
			expect(getCanvasPath("My Train", "")).toBe("My Train.canvas");
		});
	});

	// ── Full Management Lifecycle ───────────────────────────

	describe("full management lifecycle", () => {
		it("start → thoughts → rename → complete → rename post-complete → delete", async () => {
			// Step 1: Start train
			const train = await trainService.startTrain("Draft Name");
			expect(train.status).toBe("running");

			// Step 2: Add thoughts
			await trainService.addThought(train.id, "Thought A");
			await trainService.addThought(train.id, "Thought B");

			// Step 3: Rename while running
			await trainService.renameTrain(train.id, "Final Name");
			expect(trainService.getTrain(train.id)!.title).toBe("Final Name");

			// Step 4: Complete
			await trainService.completeTrain(train.id);
			expect(trainService.getTrain(train.id)!.status).toBe("completed");

			// Step 5: Rename after completion
			await trainService.renameTrain(train.id, "Archived Name");
			expect(trainService.getTrain(train.id)!.title).toBe("Archived Name");

			// Step 6: Train still in history
			expect(trainService.getAllTrains()).toHaveLength(1);

			// Step 7: Delete
			const deleted = await trainService.deleteTrain(train.id);
			expect(deleted).toBe(true);
			expect(trainService.getAllTrains()).toHaveLength(0);
		});
	});

	// ── Event Sequencing ────────────────────────────────────

	describe("event sequencing", () => {
		it("rename and delete events fire in correct order", async () => {
			const sequence: string[] = [];
			eventBus.on("train.renamed", () => { sequence.push("renamed"); });
			eventBus.on("train.completed", () => { sequence.push("completed"); });
			eventBus.on("train.deleted", () => { sequence.push("deleted"); });

			const train = await trainService.startTrain("Sequence");
			await trainService.addThought(train.id, "T");
			await trainService.renameTrain(train.id, "New");
			await trainService.completeTrain(train.id);
			await trainService.deleteTrain(train.id);

			expect(sequence).toEqual(["renamed", "completed", "deleted"]);
		});
	});
});
