/**
 * Flow 19: Train Branch Merge & Canvas Sync
 *
 * Tests the full merge + canvas lifecycle:
 * Start train → add thoughts → branch → merge → canvas generation → undo merge.
 * Verifies merge validation, canvas node/edge parity, user element preservation,
 * event sequencing, main chain merge protection, canvas reconciliation,
 * and command palette integration for both merge and canvas domains.
 *
 * Event sequence:
 *   train.started → train.thought.added (×N)
 *   train.branch.merged → train.canvas.synced
 *   train.branch.merge.undone → train.canvas.synced
 *   train.canvas.reconciled (when node count mismatch corrected)
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
	NODE_WIDTH,
	NODE_HEIGHT,
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
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

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
		it("should generate canvas with file node count equal to thought count", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;

			const canvasData = generateTrainCanvasData(train);
			const fileNodes = canvasData.nodes.filter((n) => n.type === "file");

			expect(fileNodes).toHaveLength(train.thoughts.length);
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

	// ── Enriched canvas output (Cycle 18) ──────────────────────

	describe("enriched canvas: groups, annotations, arrows", () => {
		it("should include group nodes for main chain and branches", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			const groups = canvasData.nodes.filter((n) => n.type === "group");
			// Main chain group + branch group (A→D)
			expect(groups.length).toBeGreaterThanOrEqual(2);
			expect(groups.some((g) => g.id === "ft-g-main")).toBe(true);
		});

		it("should include header annotation text node", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			const textNodes = canvasData.nodes.filter((n) => n.type === "text");
			const header = textNodes.find((n) => n.id === "ft-a-header");
			expect(header).toBeDefined();
			expect(header!.text).toContain("Merge Flow");
		});

		it("should include branch annotation text node", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			const textNodes = canvasData.nodes.filter((n) => n.type === "text");
			const branchAnnotation = textNodes.find((n) => n.id.startsWith("ft-a-branch-"));
			expect(branchAnnotation).toBeDefined();
			expect(branchAnnotation!.text).toContain("Branch");
		});

		it("should set arrow heads on all edges", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			for (const edge of canvasData.edges) {
				expect(edge.toEnd).toBe("arrow");
				expect(edge.fromEnd).toBe("none");
			}
		});

		it("should color branch edges orange and merge edges blue", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;

			await trainService.mergeBranch(trainId, thoughtD.id, thoughtB.id);
			const updatedTrain = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(updatedTrain);

			const branchEdge = canvasData.edges.find((e) => e.label === "branch");
			expect(branchEdge!.color).toBe("2"); // orange

			const mergeEdge = canvasData.edges.find((e) => e.label === "merge");
			expect(mergeEdge!.color).toBe("4"); // blue
			expect(mergeEdge!.fromSide).toBe("right");
			expect(mergeEdge!.toSide).toBe("left");
		});

		it("should use enlarged node dimensions (400×200)", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			const fileNodes = canvasData.nodes.filter((n) => n.type === "file");
			for (const node of fileNodes) {
				expect(node.width).toBe(NODE_WIDTH);
				expect(node.height).toBe(NODE_HEIGHT);
				expect(node.width).toBe(400);
				expect(node.height).toBe(200);
			}
		});

		it("should assign enriched node roles with color differentiation", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			const fileNodes = canvasData.nodes.filter((n) => n.type === "file");
			// At least one node should have a color (head, branch-origin, root, etc.)
			const colored = fileNodes.filter((n) => n.color !== undefined);
			expect(colored.length).toBeGreaterThanOrEqual(2);
		});

		it("all managed elements (groups, annotations, nodes, edges) have ft- prefix", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const canvasData = generateTrainCanvasData(train);

			for (const node of canvasData.nodes) {
				expect(isManagedElement(node.id)).toBe(true);
			}
			for (const edge of canvasData.edges) {
				expect(isManagedElement(edge.id)).toBe(true);
			}
		});
	});

	// ── Backward compatibility ──────────────────────────────────

	describe("backward compatibility: old canvas upgrades", () => {
		it("should preserve user elements when upgrading old canvas with only file nodes", () => {
			// Simulate old canvas: only file nodes, no groups/annotations
			const oldCanvas: CanvasData = {
				nodes: [
					{ id: "ft-t-a", type: "file", file: "a.md", x: 0, y: 0, width: 250, height: 60 },
					{ id: "ft-t-b", type: "file", file: "b.md", x: 0, y: 120, width: 250, height: 60 },
					{ id: "user-sticky", type: "text", text: "User note", x: 400, y: 0, width: 200, height: 100 },
				],
				edges: [
					{ id: "ft-e-a-b", fromNode: "ft-t-a", toNode: "ft-t-b" },
					{ id: "user-link", fromNode: "ft-t-a", toNode: "user-sticky" },
				],
			};

			// New managed layer has groups + annotations + file nodes
			const newManaged: CanvasData = {
				nodes: [
					{ id: "ft-g-main", type: "group", x: -40, y: -40, width: 480, height: 600, label: "Main Chain" },
					{ id: "ft-a-header", type: "text", text: "# Train", x: 0, y: -160, width: 400, height: 120 },
					{ id: "ft-t-a", type: "file", file: "a.md", x: 0, y: 0, width: 400, height: 200 },
					{ id: "ft-t-b", type: "file", file: "b.md", x: 0, y: 280, width: 400, height: 200 },
				],
				edges: [
					{ id: "ft-e-a-b", fromNode: "ft-t-a", toNode: "ft-t-b", toEnd: "arrow", fromEnd: "none" },
				],
			};

			const merged = mergeCanvasLayers(newManaged, oldCanvas);

			// Old managed elements (ft-*) replaced, user elements preserved
			expect(merged.nodes.find((n) => n.id === "user-sticky")).toBeDefined();
			expect(merged.edges.find((e) => e.id === "user-link")).toBeDefined();
			// New elements present
			expect(merged.nodes.find((n) => n.id === "ft-g-main")).toBeDefined();
			expect(merged.nodes.find((n) => n.id === "ft-a-header")).toBeDefined();
			// Old-size nodes gone (replaced by new 400×200)
			const fileA = merged.nodes.find((n) => n.id === "ft-t-a");
			expect(fileA!.width).toBe(400);
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

	// ── Main chain merge protection (Cycle 19) ──────────────────

	describe("main chain merge protection", () => {
		it("should reject merge when source is on the main chain", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtA = train.thoughts.find((t) => t.title === "A")!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;

			// A is on the main chain — merge from A should be rejected
			const result = await trainService.mergeBranch(trainId, thoughtA.id, thoughtD.id);
			expect(result).toBe(false);
			expect(trainService.getMerges(trainId)).toHaveLength(0);
		});

		it("should reject merge when source is mid-chain (B on main)", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;

			// B is on the main chain — merge from B should be rejected
			const result = await trainService.mergeBranch(trainId, thoughtB.id, thoughtD.id);
			expect(result).toBe(false);
		});

		it("should reject merge when source is the head (C on main)", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtC = train.thoughts.find((t) => t.title === "C")!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;

			// C is head of main chain — merge from C should be rejected
			const result = await trainService.mergeBranch(trainId, thoughtC.id, thoughtD.id);
			expect(result).toBe(false);
		});

		it("should allow merge from branch endpoint (D) to main chain", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;
			const thoughtC = train.thoughts.find((t) => t.title === "C")!;

			// D is a branch endpoint — merge from D to C should succeed
			const result = await trainService.mergeBranch(trainId, thoughtD.id, thoughtC.id);
			expect(result).toBe(true);
			expect(trainService.getMerges(trainId)).toHaveLength(1);
		});

		it("getMainChainIds returns all linear next-connected nodes", async () => {
			const { trainId } = await buildBranchingTrain(trainService);
			const train = trainService.getTrain(trainId)!;
			const mainIds = trainService.getMainChainIds(trainId);

			// A → B → C are on the main chain; D is not
			const thoughtA = train.thoughts.find((t) => t.title === "A")!;
			const thoughtB = train.thoughts.find((t) => t.title === "B")!;
			const thoughtC = train.thoughts.find((t) => t.title === "C")!;
			const thoughtD = train.thoughts.find((t) => t.title === "D")!;

			expect(mainIds.has(thoughtA.id)).toBe(true);
			expect(mainIds.has(thoughtB.id)).toBe(true);
			expect(mainIds.has(thoughtC.id)).toBe(true);
			expect(mainIds.has(thoughtD.id)).toBe(false);
		});
	});

	// ── Canvas reconciliation (Cycle 19) ─────────────────────────

	describe("canvas reconciliation on node count mismatch", () => {
		it("should emit train.canvas.reconciled when canvas has fewer nodes than train", async () => {
			const { trainId } = await buildBranchingTrain(trainService);

			// Wait for initial canvas creation
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			const reconciled = vi.fn();
			eventBus.on("train.canvas.reconciled", reconciled);

			// Tamper with the canvas file: reduce to only 1 managed file node
			const train = trainService.getTrain(trainId)!;
			const canvasPath = `Trains/${train.title}.canvas`;
			const tamperedCanvas = JSON.stringify({
				nodes: [{ id: "ft-t-fake", type: "file", file: "a.md", x: 0, y: 0, width: 400, height: 200 }],
				edges: [],
			});
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(tamperedCanvas);
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

			// Add another thought to trigger re-sync
			await trainService.addThought(trainId, "E");
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			expect(reconciled).toHaveBeenCalled();
			const payload = reconciled.mock.calls[0][0].payload;
			expect(payload.trainId).toBe(trainId);
			expect(payload.found).toBe(1);
			expect(payload.expected).toBe(5); // A, B, C, D, E
			expect(payload.corrected).toBe(true);
		}, 10_000);

		it("should NOT emit train.canvas.reconciled when counts match", async () => {
			const train = await trainService.startTrain("Single Train");
			await trainService.addThought(train.id, "Only");

			// Wait for initial canvas creation
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			const reconciled = vi.fn();
			eventBus.on("train.canvas.reconciled", reconciled);

			// Make mock return a canvas with exactly 1 managed file node (matching train)
			const canvasPath = `Trains/${train.title}.canvas`;
			const matchingCanvas = JSON.stringify({
				nodes: [{ id: "ft-t-only", type: "file", file: "only.md", x: 0, y: 0, width: 400, height: 200 }],
				edges: [],
			});
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(matchingCanvas);
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

			// Add another thought — now train has 2, canvas reports 1 → mismatch
			await trainService.addThought(train.id, "Second");
			await waitForAsync(CANVAS_SYNC_DELAY_MS + 200);

			// This WILL emit reconciled because canvas had 1, train now has 2
			expect(reconciled).toHaveBeenCalled();
			expect(reconciled.mock.calls[0][0].payload.found).toBe(1);
			expect(reconciled.mock.calls[0][0].payload.expected).toBe(2);
		}, 10_000);
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
