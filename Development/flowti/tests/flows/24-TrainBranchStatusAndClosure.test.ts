/**
 * Flow 24: Branch Status Labels, Train Closure Context, Type Filter
 *
 * Covers Cycle 26 integration scenarios:
 *   - Branch status labels (set, cycle, clear, persist, events)
 *   - Train data for closure context (type, thoughts, branches, merges)
 *   - Type filtering on train data (getAllTrains + type filter)
 *
 * Event sequences tested:
 *   train.started → train.thought.added → train.branch.status.changed
 *   train.started → train.thought.added → train.completed → closure context
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import type { TrainServiceState, BranchStatus } from "../../src/domain/train/types";
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
			},
		});
	});

	eventBus.on("session.start", () => {});
	eventBus.on("session.complete", () => {});

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

	return { trainService, eventBus, fileSystem };
}

describe("Flow 24: Branch Status, Closure Context, Type Filter", () => {
	let trainService: TrainService;
	let eventBus: IEventBus;

	beforeEach(async () => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		eventBus = harness.eventBus;
		await trainService.load();
	});

	// ── Branch Status Labels ─────────────────────────────────

	describe("branch status lifecycle", () => {
		it("set exploring → promising → stale → clear on branch origin", async () => {
			const train = await trainService.startTrain("Status Cycle", 15, "brainstorm");
			const a = await trainService.addThought(train.id, "Main Idea");
			await trainService.addThought(train.id, "Continuation");
			const branch = await trainService.addThought(train.id, "Side Thought", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// Set exploring
			const setResult = await trainService.setBranchStatus(train.id, branch!.id, "exploring");
			expect(setResult).toBe(true);
			expect(trainService.getTrain(train.id)!.thoughts.find((t) => t.id === branch!.id)!.branchStatus).toBe("exploring");

			// Upgrade to promising
			await trainService.setBranchStatus(train.id, branch!.id, "promising");
			expect(trainService.getTrain(train.id)!.thoughts.find((t) => t.id === branch!.id)!.branchStatus).toBe("promising");

			// Downgrade to stale
			await trainService.setBranchStatus(train.id, branch!.id, "stale");
			expect(trainService.getTrain(train.id)!.thoughts.find((t) => t.id === branch!.id)!.branchStatus).toBe("stale");

			// Clear
			const clearResult = await trainService.clearBranchStatus(train.id, branch!.id);
			expect(clearResult).toBe(true);
			expect(trainService.getTrain(train.id)!.thoughts.find((t) => t.id === branch!.id)!.branchStatus).toBeUndefined();
		});

		it("emits train.branch.status.changed events for each status change", async () => {
			const events: Array<{ thoughtId: string; status: BranchStatus | null }> = [];
			eventBus.on("train.branch.status.changed", (e) => {
				events.push(e.payload);
			});

			const train = await trainService.startTrain("Event Test", 0, "research");
			const a = await trainService.addThought(train.id, "Root");
			await trainService.addThought(train.id, "Next");
			const branch = await trainService.addThought(train.id, "Branch", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			await trainService.setBranchStatus(train.id, branch!.id, "exploring");
			await trainService.setBranchStatus(train.id, branch!.id, "promising");
			await trainService.clearBranchStatus(train.id, branch!.id);

			expect(events).toHaveLength(3);
			expect(events[0].status).toBe("exploring");
			expect(events[1].status).toBe("promising");
			expect(events[2].status).toBeNull();
		});

		it("rejects setBranchStatus on non-branch thought", async () => {
			const train = await trainService.startTrain("Reject Test", 10, "decision");
			const main = await trainService.addThought(train.id, "Main");
			await trainService.addThought(train.id, "Next");

			const result = await trainService.setBranchStatus(train.id, main!.id, "exploring");
			expect(result).toBe(false);
		});

		it("branch status persists across completeTrain", async () => {
			const train = await trainService.startTrain("Persist Test", 0, "brainstorm");
			const a = await trainService.addThought(train.id, "Main");
			await trainService.addThought(train.id, "Continue");
			const branch = await trainService.addThought(train.id, "Branch", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			await trainService.setBranchStatus(train.id, branch!.id, "promising");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			const completed = trainService.getTrain(train.id)!;
			expect(completed.status).toBe("completed");
			expect(completed.thoughts.find((t) => t.id === branch!.id)!.branchStatus).toBe("promising");
		});
	});

	// ── Train Closure Context ────────────────────────────────

	describe("train data for session closure", () => {
		it("completed train provides stats for closure panel", async () => {
			const train = await trainService.startTrain("Closure Context", 15, "brainstorm");
			const a = await trainService.addThought(train.id, "Start");
			await trainService.addThought(train.id, "Middle");
			await trainService.addThought(train.id, "End");
			const branch = await trainService.addThought(train.id, "Side", {
				direction: "branch",
				fromThoughtId: a!.id,
			});
			await trainService.mergeBranch(train.id, branch!.id, trainService.getTrain(train.id)!.thoughts[1].id);

			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			const completed = trainService.getTrain(train.id)!;

			// Verify all closure panel data is available
			expect(completed.trainType).toBe("brainstorm");
			expect(completed.thoughts).toHaveLength(4);
			expect(completed.relations.filter((r) => r.direction === "branch")).toHaveLength(1);
			expect(completed.relations.filter((r) => r.direction === "merge")).toHaveLength(1);
			expect(completed.completedAt).not.toBeNull();
			expect(completed.sessionId).toBeTruthy();
		});

		it("train is findable by sessionId for closure wiring", async () => {
			const train = await trainService.startTrain("Session Link", 0, "research");
			await trainService.addThought(train.id, "Idea");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			// Simulate how SessionWorkspaceView finds the train
			const allTrains = trainService.getAllTrains();
			const match = allTrains.find((t) => t.sessionId === train.sessionId);
			expect(match).toBeDefined();
			expect(match!.id).toBe(train.id);
		});
	});

	// ── Type Filter Data ─────────────────────────────────────

	describe("type filter on train data", () => {
		it("trains can be filtered by trainType", async () => {
			await trainService.startTrain("Brainstorm 1", 15, "brainstorm");
			const t1 = trainService.getActiveTrain();
			await trainService.addThought(t1!.id, "Idea");
			await trainService.completeTrain(t1!.id);
			await waitForAsync(50);

			await trainService.startTrain("Research 1", 25, "research");
			const t2 = trainService.getActiveTrain();
			await trainService.addThought(t2!.id, "Finding");
			await trainService.completeTrain(t2!.id);
			await waitForAsync(50);

			await trainService.startTrain("Brainstorm 2", 15, "brainstorm");
			const t3 = trainService.getActiveTrain();
			await trainService.addThought(t3!.id, "More Ideas");
			await trainService.completeTrain(t3!.id);
			await waitForAsync(50);

			const all = trainService.getAllTrains();
			expect(all).toHaveLength(3);

			const brainstorms = all.filter((t) => t.trainType === "brainstorm");
			expect(brainstorms).toHaveLength(2);

			const research = all.filter((t) => t.trainType === "research");
			expect(research).toHaveLength(1);
		});

		it("trains can be sorted by thought count", async () => {
			await trainService.startTrain("Few", 10, "decision");
			const t1 = trainService.getActiveTrain();
			await trainService.addThought(t1!.id, "Single");
			await trainService.completeTrain(t1!.id);
			await waitForAsync(50);

			await trainService.startTrain("Many", 25, "research");
			const t2 = trainService.getActiveTrain();
			await trainService.addThought(t2!.id, "A");
			await trainService.addThought(t2!.id, "B");
			await trainService.addThought(t2!.id, "C");
			await trainService.addThought(t2!.id, "D");
			await trainService.completeTrain(t2!.id);
			await waitForAsync(50);

			const all = trainService.getAllTrains();
			const sorted = [...all].sort((a, b) => b.thoughts.length - a.thoughts.length);
			expect(sorted[0].title).toBe("Many");
			expect(sorted[0].thoughts).toHaveLength(4);
			expect(sorted[1].title).toBe("Few");
			expect(sorted[1].thoughts).toHaveLength(1);
		});

		it("BUILT_IN_TRAIN_TYPES covers all used types", () => {
			const typeIds = BUILT_IN_TRAIN_TYPES.map((t) => t.id);
			expect(typeIds).toContain("brainstorm");
			expect(typeIds).toContain("research");
			expect(typeIds).toContain("decision");
			expect(typeIds).toContain("free-form");
			expect(typeIds).toHaveLength(4);
		});

		it("combined type filter + sort by thoughts works", async () => {
			await trainService.startTrain("BS Small", 15, "brainstorm");
			const bs1 = trainService.getActiveTrain();
			await trainService.addThought(bs1!.id, "One");
			await trainService.completeTrain(bs1!.id);
			await waitForAsync(50);

			await trainService.startTrain("Research Big", 25, "research");
			const r1 = trainService.getActiveTrain();
			await trainService.addThought(r1!.id, "A");
			await trainService.addThought(r1!.id, "B");
			await trainService.addThought(r1!.id, "C");
			await trainService.completeTrain(r1!.id);
			await waitForAsync(50);

			await trainService.startTrain("BS Big", 15, "brainstorm");
			const bs2 = trainService.getActiveTrain();
			await trainService.addThought(bs2!.id, "X");
			await trainService.addThought(bs2!.id, "Y");
			await trainService.completeTrain(bs2!.id);
			await waitForAsync(50);

			const all = trainService.getAllTrains();
			const brainstorms = all
				.filter((t) => t.trainType === "brainstorm")
				.sort((a, b) => b.thoughts.length - a.thoughts.length);

			expect(brainstorms).toHaveLength(2);
			expect(brainstorms[0].title).toBe("BS Big");
			expect(brainstorms[0].thoughts).toHaveLength(2);
			expect(brainstorms[1].title).toBe("BS Small");
			expect(brainstorms[1].thoughts).toHaveLength(1);
		});
	});

	// ── Event Sequencing ─────────────────────────────────────

	describe("event sequencing", () => {
		it("branch status events fire in order with thought events", async () => {
			const sequence: string[] = [];
			eventBus.on("train.thought.added", () => { sequence.push("thought.added"); });
			eventBus.on("train.branch.status.changed", () => { sequence.push("status.changed"); });
			eventBus.on("train.completed", () => { sequence.push("completed"); });

			const train = await trainService.startTrain("Sequence", 0, "brainstorm");
			sequence.length = 0; // Clear startup events

			const a = await trainService.addThought(train.id, "A");
			const branch = await trainService.addThought(train.id, "Branch", {
				direction: "branch",
				fromThoughtId: a!.id,
			});
			await trainService.setBranchStatus(train.id, branch!.id, "promising");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			expect(sequence[0]).toBe("thought.added"); // A
			expect(sequence[1]).toBe("thought.added"); // Branch
			expect(sequence[2]).toBe("status.changed"); // set promising
			expect(sequence[3]).toBe("completed");
		});
	});
});
