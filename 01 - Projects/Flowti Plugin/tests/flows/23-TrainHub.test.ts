/**
 * Flow 23: Train Hub — Cycle 24 integration scenarios
 *
 * Covers: Train Hub rendering, type selection, jump-to-end, smart resume,
 * property editor, type badge display.
 *
 * Event sequences tested:
 *   train.started → train.thought.added (×N) → navigation → resume
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import type { TrainServiceState, TrainState } from "../../src/domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../src/domain/train/types";
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

	// Simulate SessionService
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
		featureName: null,
			},
		});
	});

	eventBus.on("session.start", () => {});
	eventBus.on("session.complete", () => {});

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

	return { trainService, eventBus, fileSystem };
}

describe("Flow 23: Train Hub & Cycle 24 Integration", () => {
	let trainService: TrainService;
	let eventBus: IEventBus;

	beforeEach(async () => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		eventBus = harness.eventBus;
		await trainService.load();
	});

	// ── Train Types ──────────────────────────────────────────

	it("creates a train with brainstorm type and stores it", async () => {
		const train = await trainService.startTrain("Idea Storm", 15, "brainstorm");
		expect(train.trainType).toBe("brainstorm");
		expect(train.durationMinutes).toBe(15);

		const retrieved = trainService.getTrain(train.id);
		expect(retrieved?.trainType).toBe("brainstorm");
	});

	it("creates a train with research type and 25min duration", async () => {
		const train = await trainService.startTrain("Deep Dive", 25, "research");
		expect(train.trainType).toBe("research");
		expect(train.durationMinutes).toBe(25);
	});

	it("creates a train without type for backward compatibility", async () => {
		const train = await trainService.startTrain("Legacy Train", 0);
		expect(train.trainType).toBeUndefined();
	});

	it("BUILT_IN_TRAIN_TYPES constant resolves existing type", () => {
		const config = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "decision");
		expect(config).toBeDefined();
		expect(config!.label).toBe("Decision");
		expect(config!.defaultDuration).toBe(10);
	});

	// ── Head Node Navigation ─────────────────────────────────

	it("getHeadNode returns last main-chain thought", async () => {
		const train = await trainService.startTrain("Chain Test", 0, "brainstorm");
		await trainService.addThought(train.id, "A");
		await trainService.addThought(train.id, "B");
		await trainService.addThought(train.id, "C");

		const head = trainService.getHeadNode(train.id);
		expect(head?.title).toBe("C");
	});

	it("getHeadNode excludes branches", async () => {
		const train = await trainService.startTrain("Branch Exclusion", 0, "research");
		await trainService.addThought(train.id, "A");
		const thoughtB = await trainService.addThought(train.id, "B");
		await trainService.addThought(train.id, "B-branch", { direction: "branch" });
		await trainService.addThought(train.id, "C", { fromThoughtId: thoughtB!.id });

		const head = trainService.getHeadNode(train.id);
		expect(head?.title).toBe("C");
	});

	it("getHeadNode returns null for empty train", async () => {
		const train = await trainService.startTrain("Empty", 0, "free-form");
		const head = trainService.getHeadNode(train.id);
		expect(head).toBeNull();
	});

	// ── Resume Flow ──────────────────────────────────────────

	it("pause → resume preserves thoughts and type", async () => {
		const train = await trainService.startTrain("Pausable", 10, "decision");
		await trainService.addThought(train.id, "First");
		await trainService.addThought(train.id, "Second");

		await trainService.pause(train.id);
		expect(trainService.getTrain(train.id)?.status).toBe("paused");

		await trainService.resume(train.id);
		const resumed = trainService.getTrain(train.id);
		expect(resumed?.status).toBe("running");
		expect(resumed?.thoughts).toHaveLength(2);
		expect(resumed?.trainType).toBe("decision");
	});

	it("smart resume scenario: mid-chain active thought differs from head", async () => {
		const train = await trainService.startTrain("Smart Resume", 0, "brainstorm");
		await trainService.addThought(train.id, "A");
		await trainService.addThought(train.id, "B");
		await trainService.addThought(train.id, "C");

		// The head is C. If user is viewing A, they are mid-chain.
		const timeline = trainService.getTimeline(train.id);
		const headNode = trainService.getHeadNode(train.id);
		expect(timeline).toHaveLength(3);
		expect(headNode?.title).toBe("C");
		expect(timeline[0].title).toBe("A");
		// A ≠ C → smart resume modal should appear
		expect(timeline[0].id).not.toBe(headNode?.id);
	});

	// ── Train Hub Data ───────────────────────────────────────

	it("getAllTrains returns all created trains", async () => {
		await trainService.startTrain("Alpha", 15, "brainstorm");
		await trainService.startTrain("Beta", 25, "research");

		const all = trainService.getAllTrains();
		expect(all).toHaveLength(2);
		expect(all.map((t) => t.title)).toContain("Alpha");
		expect(all.map((t) => t.title)).toContain("Beta");
	});

	it("nesting: second train pauses first, both retrievable", async () => {
		const t1 = await trainService.startTrain("First", 15, "brainstorm");
		const t2 = await trainService.startTrain("Second", 25, "research");

		// First train should be paused (nesting)
		const first = trainService.getTrain(t1.id);
		expect(first?.status).toBe("paused");

		// Second train is running
		const second = trainService.getTrain(t2.id);
		expect(second?.status).toBe("running");
		expect(second?.trainType).toBe("research");

		// getAllTrains has both
		const all = trainService.getAllTrains();
		expect(all).toHaveLength(2);
	});

	it("completed train has type preserved", async () => {
		const train = await trainService.startTrain("Completable", 10, "decision");
		await trainService.addThought(train.id, "Only Thought");
		await trainService.completeTrain(train.id);

		const completed = trainService.getTrain(train.id);
		expect(completed?.status).toBe("completed");
		expect(completed?.trainType).toBe("decision");
	});
});
