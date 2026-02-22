/**
 * Flow 19: Train Branch Merge & Canvas Sync
 *
 * Tests the full merge + canvas lifecycle:
 * Start train → add thoughts → branch → merge → canvas generation → undo merge.
 * Verifies merge validation, canvas node/edge parity, user element preservation,
 * and event sequencing for both merge and canvas domains.
 *
 * Event sequence:
 *   train.started → train.thought.added (×N)
 *   train.branch.merged → train.canvas.synced
 *   train.branch.merge.undone → train.canvas.synced
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { TrainCanvasSyncService, CANVAS_SYNC_DELAY_MS } from "../../src/domain/train/TrainCanvasSyncService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import {
	generateTrainCanvasData,
	mergeCanvasLayers,
	isManagedElement,
} from "../../src/domain/train/TrainCanvasWriter";
import type { TrainServiceState, TrainState } from "../../src/domain/train/types";
import type { CanvasData } from "obsidian/canvas";
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

	// Simulate SessionService: session.create → session.created → ready
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

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains" });

	const canvasSyncService = new TrainCanvasSyncService({
		eventBus,
		fileSystem,
		getSettings: () => ({ trainFolder: "Trains", trainCanvasEnabled: true }),
		getTrain: (id) => trainService.getTrain(id),
	});
	canvasSyncService.setup();

	return { trainService, canvasSyncService, eventBus, fileSystem };
}

/**
 * Build a standard branching train for merge tests:
 * A → B → C (main chain), A → D (branch endpoint)
 */
async function buildBranchingTrain(trainService: TrainService) {
	const train = await trainService.startTrain("Merge Flow");
	await trainService.addThought(train.id, "A");
	const thoughtA = trainService.getTrain(train.id)!.thoughts[0];
	await trainService.addThought(train.id, "B");
	await trainService.addThought(train.id, "C");
	await trainService.addThought(train.id, "D", {
		direction: "branch",
		fromThoughtId: thoughtA.id,
	});

	return { trainId: train.id, thoughtA };
}

describe("Flow 19: Train Branch Merge & Canvas Sync", () => {
	let trainService: TrainService;
	let canvasSyncService: TrainCanvasSyncService;
	let eventBus: IEventBus;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		canvasSyncService = harness.canvasSyncService;
		eventBus = harness.eventBus;
		fileSystem = harness.fileSystem;
	});

	// ── Merge lifecycle ─────────────────────────────────────────

	describe("merge lifecycle: branch → merge → undo", () => {
		it("should merge a branch endpoint into a main chain thought", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			const merged = vi.fn();
			eventBus.on("train.branch.merged", merged);

			const result = await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			expect(result).toBe(true);
			expect(merged).toHaveBeenCalledOnce();
			expect(merged.mock.calls[0][0].payload).toEqual({
				trainId,
				sourceId: thoughtD.id,
				targetId: thoughtB.id,
			});

			// Verify merge relation exists
			const merges = trainService.getMerges(trainId);
			expect(merges).toHaveLength(1);
			expect(merges[0].direction).toBe("merge");
		});

		it("should undo a merge and emit undo event", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			const undone = vi.fn();
			eventBus.on("train.branch.merge.undone", undone);

			const result = await trainService.undoMerge(trainId, thoughtD.id, thoughtB.id);

			expect(result).toBe(true);
			expect(undone).toHaveBeenCalledOnce();
			expect(trainService.getMerges(trainId)).toHaveLength(0);
		});

		it("should reject cycle: merge target is a descendant of source", async () => {
			const train = await trainService.startTrain("Cycle Test");
			await trainService.addThought(train.id, "X");
			await trainService.addThought(train.id, "Y");
			await trainService.addThought(train.id, "Z");

			const t = trainService.getTrain(train.id)!;
			const thoughtX = t.thoughts.find((th) => th.title === "X")!;
			const thoughtZ = t.thoughts.find((th) => th.title === "Z")!;

			// X→Y→Z chain, merging X→Z would create a cycle (Z reachable from X)
			const result = await trainService.mergeBranch(train.id, thoughtX.id, thoughtZ.id);
			expect(result).toBe(false);
			expect(trainService.getMerges(train.id)).toHaveLength(0);
		});

		it("should reject self-merge", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtA = train.thoughts.find((t) => t.title === "A")!;

			const result = await trainService.mergeBranch(trainId, thoughtA.id, thoughtA.id);
			expect(result).toBe(false);
		});

		it("should reject duplicate merge", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			const duplicate = await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			expect(duplicate).toBe(false);
			expect(trainService.getMerges(trainId)).toHaveLength(1);
		});

		it("should allow merge on paused train", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			await trainService.pause(trainId);

			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			const result = await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			expect(result).toBe(true);
		});

		it("should reject merge on completed train", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			await trainService.completeTrain(trainId);

			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			const result = await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			expect(result).toBe(false);
		});
	});

	// ── Canvas generation parity ────────────────────────────────

	describe("canvas generation matches train graph", () => {
		it("should generate canvas with node count equal to thought count", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;

			const canvasData = generateTrainCanvasData(train);

			expect(canvasData.nodes).toHaveLength(train.thoughts.length);
		});

		it("should generate canvas with edge count equal to relation count", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;

			const canvasData = generateTrainCanvasData(train);

			// 3 next relations (A→B, B→C) + 1 branch (A→D) = 3 relations
			expect(canvasData.edges).toHaveLength(train.relations.length);
		});

		it("should include merge edge after branch merge", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			const updatedTrain = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(updatedTrain);

			const mergeEdge = canvasData.edges.find((e) => e.label === "merge");
			expect(mergeEdge).toBeDefined();
			expect(mergeEdge!.color).toBe("4"); // blue
			expect(canvasData.edges).toHaveLength(updatedTrain.relations.length);
		});

		it("should remove merge edge after undo", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			await trainService.undoMerge(trainId, thoughtD.id, thoughtB.id);

			const updatedTrain = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(updatedTrain);

			const mergeEdge = canvasData.edges.find((e) => e.label === "merge");
			expect(mergeEdge).toBeUndefined();
		});
	});

	// ── User element preservation ───────────────────────────────

	describe("user element preservation across sync", () => {
		it("should preserve non-ft-prefixed elements during merge", () => {
			const managed: CanvasData = {
				nodes: [{ id: "ft-t-1", type: "file", file: "a.md", x: 0, y: 0, width: 250, height: 60 }],
				edges: [],
			};
			const existing: CanvasData = {
				nodes: [
					{ id: "ft-t-1", type: "file", file: "a.md", x: 0, y: 0, width: 250, height: 60 },
					{ id: "user-note-1", type: "text", text: "My annotation", x: 500, y: 0, width: 200, height: 100 },
				],
				edges: [
					{ id: "user-edge-1", fromNode: "ft-t-1", toNode: "user-note-1", fromSide: "right", toSide: "left" },
				],
			};

			const merged = mergeCanvasLayers(managed, existing);

			// Managed elements replaced (1 node), user elements preserved (1 node + 1 edge)
			expect(merged.nodes).toHaveLength(2);
			expect(merged.edges).toHaveLength(1);
			expect(merged.nodes.some((n) => n.id === "user-note-1")).toBe(true);
		});

		it("should correctly identify managed vs user elements", () => {
			expect(isManagedElement("ft-t-thought_123")).toBe(true);
			expect(isManagedElement("ft-e-abc-def")).toBe(true);
			expect(isManagedElement("user-note-1")).toBe(false);
			expect(isManagedElement("my-custom-node")).toBe(false);
		});
	});

	// ── Canvas sync service integration ─────────────────────────

	describe("canvas sync service triggers on merge events", () => {
		it("should emit train.canvas.synced after merge + debounce", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			// Wait for initial canvas sync from thought additions to settle
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			const synced = vi.fn();
			eventBus.on("train.canvas.synced", synced);

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			// Wait for debounce + execution
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			expect(synced).toHaveBeenCalled();
			expect(synced.mock.calls[0][0].payload.trainId).toBe(trainId);
		}, 10_000);

		it("should emit train.canvas.synced after undo merge + debounce", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			// Settle previous syncs
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			const synced = vi.fn();
			eventBus.on("train.canvas.synced", synced);

			await trainService.undoMerge(trainId, thoughtD.id, thoughtB.id);

			// Wait for debounce + execution
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			expect(synced).toHaveBeenCalled();
		}, 10_000);
	});

	// ── Event sequencing ────────────────────────────────────────

	describe("event sequencing for merge + canvas flow", () => {
		it("should emit events in correct order: start → thoughts → merge → undo", async () => {
			const events: string[] = [];
			eventBus.on("train.started", () => { events.push("train.started"); });
			eventBus.on("train.thought.added", () => { events.push("train.thought.added"); });
			eventBus.on("train.branch.merged", () => { events.push("train.branch.merged"); });
			eventBus.on("train.branch.merge.undone", () => { events.push("train.branch.merge.undone"); });

			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			await trainService.undoMerge(trainId, thoughtD.id, thoughtB.id);

			await waitForAsync();

			expect(events).toEqual([
				"train.started",
				"train.thought.added", // A
				"train.thought.added", // B
				"train.thought.added", // C
				"train.thought.added", // D (branch)
				"train.branch.merged",
				"train.branch.merge.undone",
			]);
		});

		it("should track merge-target nav links in frontmatter after merge", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			await vi.waitFor(() => {
				const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
				const mergeCall = calls.find((c: unknown[]) => {
					const data = c[1] as Record<string, unknown>;
					return Array.isArray(data["merge-target"]) && (data["merge-target"] as string[]).length > 0;
				});
				expect(mergeCall).toBeDefined();
			});
		});
	});

	// ── Cleanup ─────────────────────────────────────────────────

	describe("cleanup", () => {
		it("should stop sync timers on destroy", async () => {
			canvasSyncService.destroy();

			const synced = vi.fn();
			eventBus.on("train.canvas.synced", synced);

			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;
			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);

			// Wait past the debounce window — destroyed service should not fire
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			// Since service was destroyed before merge, no sync event
			expect(synced).not.toHaveBeenCalled();
		}, 10_000);
	});
});
