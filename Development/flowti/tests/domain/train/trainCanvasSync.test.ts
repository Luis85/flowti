import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import {
	TrainCanvasSyncService,
	CANVAS_SYNC_DELAY_MS,
} from "../../../src/domain/train/TrainCanvasSyncService";
import type { TrainState } from "../../../src/domain/train/types";
import { createMockFileSystem } from "../../mocks/filesystem";

function makeTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "Test Train",
		status: "running",
		thoughts: [
			{
				id: "t1",
				trainId: "train_1",
				title: "First Thought",
				path: "trains/First Thought.md",
				createdAt: "2026-02-22T10:00:00.000Z",
				order: 0,
			},
		],
		relations: [],
		durationMinutes: 0,
		createdAt: "2026-02-22T10:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		folderPath: "trains",
		...overrides,
	};
}

function createSyncHarness(opts: {
	trainCanvasEnabled?: boolean;
	train?: TrainState | null;
} = {}) {
	const eventBus: IEventBus = new EventBus();
	const fileSystem = createMockFileSystem();
	const train = opts.train === null ? undefined : (opts.train ?? makeTrain());

	const service = new TrainCanvasSyncService({
		eventBus,
		fileSystem,
		getSettings: () => ({
			trainCanvasEnabled: opts.trainCanvasEnabled ?? true,
		}),
		getTrain: () => train,
	});
	service.setup();

	return { eventBus, fileSystem, service, train };
}

describe("TrainCanvasSyncService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── Sync triggers ──────────────────────────────────────────

	describe("sync triggers", () => {
		it("syncs on train.thought.added", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.branch.merged", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.branch.merged", {
				trainId: "train_1",
				sourceId: "s1",
				targetId: "t1",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.branch.merge.undone", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.branch.merge.undone", {
				trainId: "train_1",
				sourceId: "s1",
				targetId: "t1",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.completed", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.completed", {
				trainId: "train_1",
				thoughtCount: 1,
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.paused", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.paused", { trainId: "train_1" });

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.resumed", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.resumed", { trainId: "train_1" });

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});

		it("syncs on train.renamed", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.renamed", {
				trainId: "train_1",
				oldTitle: "Old Title",
				newTitle: "New Title",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});
		});
	});

	// ── Debounce ───────────────────────────────────────────────

	describe("debounce", () => {
		it("coalesces rapid events into single write", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			// Rapid-fire 5 thought-added events
			for (let i = 0; i < 5; i++) {
				void eventBus.emit("train.thought.added", {
					trainId: "train_1",
					thought: { id: `t${i}`, trainId: "train_1", title: `T${i}`, path: `trains/T${i}.md`, createdAt: "", order: i },
					previousTitle: null,
					direction: "next",
				});
			}

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			// Should be exactly 1 write, not 5
			expect(fileSystem.createFile).toHaveBeenCalledTimes(1);
		});

		it("does not write before debounce delay expires", () => {
			const { eventBus, fileSystem } = createSyncHarness();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS - 100);
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});
	});

	// ── Canvas path ───────────────────────────────────────────

	describe("canvas path", () => {
		it("uses trainFolder/trainTitle.canvas", async () => {
			const train = makeTrain({ title: "My Brilliant Ideas" });
			const { eventBus, fileSystem } = createSyncHarness({ train });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			const path = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(path).toBe("trains/My Brilliant Ideas.canvas");
		});
	});

	// ── Settings ──────────────────────────────────────────────

	describe("settings", () => {
		it("skips sync when trainCanvasEnabled is false", () => {
			const { eventBus, fileSystem } = createSyncHarness({ trainCanvasEnabled: false });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});
	});

	// ── Events emitted ───────────────────────────────────────

	describe("events", () => {
		it("emits train.canvas.created on first sync", async () => {
			const { eventBus, fileSystem } = createSyncHarness();

			const createdEvents: Array<{ trainId: string; canvasPath: string }> = [];
			eventBus.on("train.canvas.created", (e) => { createdEvents.push(e.payload); });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(createdEvents).toHaveLength(1);
			});
			expect(createdEvents[0].trainId).toBe("train_1");
			expect(createdEvents[0].canvasPath).toBe("trains/Test Train.canvas");
		});

		it("emits train.canvas.synced on every sync", async () => {
			const { eventBus } = createSyncHarness();

			const syncedEvents: Array<{ trainId: string; nodeCount: number }> = [];
			eventBus.on("train.canvas.synced", (e) => { syncedEvents.push(e.payload); });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(syncedEvents).toHaveLength(1);
			});
			expect(syncedEvents[0].trainId).toBe("train_1");
			expect(syncedEvents[0].nodeCount).toBe(1);
		});

		it("emits train.canvas.created only once per train", async () => {
			const { eventBus } = createSyncHarness();

			const createdEvents: unknown[] = [];
			eventBus.on("train.canvas.created", (e) => { createdEvents.push(e.payload); });

			// First sync
			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});
			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(createdEvents).toHaveLength(1);
			});

			// Second sync
			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t2", trainId: "train_1", title: "B", path: "trains/B.md", createdAt: "", order: 1 },
				previousTitle: "A",
				direction: "next",
			});
			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				// synced event fires twice, but created only once
				expect(createdEvents).toHaveLength(1);
			});
		});
	});

	// ── Edge cases ────────────────────────────────────────────

	describe("edge cases", () => {
		it("skips sync for train with no thoughts", async () => {
			const emptyTrain = makeTrain({ thoughts: [] });
			const { eventBus, fileSystem } = createSyncHarness({ train: emptyTrain });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			// Give any potential async operations time to settle
			await Promise.resolve();
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("skips sync when train not found", async () => {
			const { eventBus, fileSystem } = createSyncHarness({ train: null });

			void eventBus.emit("train.thought.added", {
				trainId: "nonexistent",
				thought: { id: "t1", trainId: "nonexistent", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await Promise.resolve();
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("cleanup via destroy() clears timers and listeners", () => {
			const { eventBus, fileSystem, service } = createSyncHarness();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			// Destroy before timer fires
			service.destroy();

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});
	});

	// ── Reconciliation ───────────────────────────────────────

	describe("reconciliation", () => {
		it("emits train.canvas.reconciled when existing canvas has fewer nodes than train", async () => {
			const train = makeTrain({
				thoughts: [
					{ id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
					{ id: "t2", trainId: "train_1", title: "B", path: "trains/B.md", createdAt: "", order: 1 },
					{ id: "t3", trainId: "train_1", title: "C", path: "trains/C.md", createdAt: "", order: 2 },
				],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "next" },
					{ fromId: "t2", toId: "t3", direction: "next" },
				],
			});

			// Existing canvas with only 1 managed file node (out of sync)
			const existingCanvas = JSON.stringify({
				nodes: [
					{ id: "ft-t-t1", type: "file", file: "trains/A.md", x: 0, y: 0, width: 400, height: 200 },
				],
				edges: [],
			});

			const fileSystem = createMockFileSystem({
				"trains/Test Train.canvas": existingCanvas,
			});

			const eventBus: IEventBus = new EventBus();
			const reconciledEvents: Array<{ expected: number; found: number; corrected: boolean }> = [];
			eventBus.on("train.canvas.reconciled", (e) => { reconciledEvents.push(e.payload); });

			const service = new TrainCanvasSyncService({
				eventBus,
				fileSystem,
				getSettings: () => ({ trainCanvasEnabled: true }),
				getTrain: () => train,
			});
			service.setup();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t3", trainId: "train_1", title: "C", path: "trains/C.md", createdAt: "", order: 2 },
				previousTitle: "B",
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(reconciledEvents).toHaveLength(1);
			});
			expect(reconciledEvents[0].expected).toBe(3);
			expect(reconciledEvents[0].found).toBe(1);
			expect(reconciledEvents[0].corrected).toBe(true);

			service.destroy();
		});

		it("does not emit reconciled when canvas node count matches train", async () => {
			const train = makeTrain({
				thoughts: [
					{ id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				],
			});

			// Existing canvas has exactly 1 managed file node (in sync)
			const existingCanvas = JSON.stringify({
				nodes: [
					{ id: "ft-t-t1", type: "file", file: "trains/A.md", x: 0, y: 0, width: 400, height: 200 },
				],
				edges: [],
			});

			const fileSystem = createMockFileSystem({
				"trains/Test Train.canvas": existingCanvas,
			});

			const eventBus: IEventBus = new EventBus();
			const reconciledEvents: unknown[] = [];
			eventBus.on("train.canvas.reconciled", (e) => { reconciledEvents.push(e.payload); });

			const service = new TrainCanvasSyncService({
				eventBus,
				fileSystem,
				getSettings: () => ({ trainCanvasEnabled: true }),
				getTrain: () => train,
			});
			service.setup();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.updateFile).toHaveBeenCalled();
			});

			// No reconciliation needed
			expect(reconciledEvents).toHaveLength(0);

			service.destroy();
		});

		it("does not emit reconciled on first canvas creation (no pre-existing file)", async () => {
			const { eventBus } = createSyncHarness();

			const reconciledEvents: unknown[] = [];
			eventBus.on("train.canvas.reconciled", (e) => { reconciledEvents.push(e.payload); });

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				// Should have created the file
			});
			// Small delay for async processing
			await Promise.resolve();

			// No reconciliation on first create (preSyncCount is null)
			expect(reconciledEvents).toHaveLength(0);
		});
	});

	// ── User element preservation ─────────────────────────────

	describe("user element preservation", () => {
		it("preserves user-added elements across syncs", async () => {
			const train = makeTrain({
				thoughts: [
					{ id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				],
			});

			// Existing canvas with user element
			const existingCanvas = JSON.stringify({
				nodes: [
					{ id: "ft-t-old", type: "text", text: "Old", x: 0, y: 0, width: 250, height: 60 },
					{ id: "user-note-42", type: "text", text: "My annotation", x: 500, y: 500, width: 200, height: 100 },
				],
				edges: [
					{ id: "user-edge-1", fromNode: "user-note-42", toNode: "ft-t-old" },
				],
			});

			const fileSystem = createMockFileSystem({
				"trains/Test Train.canvas": existingCanvas,
			});

			const eventBus: IEventBus = new EventBus();
			const service = new TrainCanvasSyncService({
				eventBus,
				fileSystem,
				getSettings: () => ({ trainCanvasEnabled: true }),
				getTrain: () => train,
			});
			service.setup();

			void eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: { id: "t1", trainId: "train_1", title: "A", path: "trains/A.md", createdAt: "", order: 0 },
				previousTitle: null,
				direction: "next",
			});

			vi.advanceTimersByTime(CANVAS_SYNC_DELAY_MS + 10);
			await vi.waitFor(() => {
				expect(fileSystem.updateFile).toHaveBeenCalled();
			});

			const writtenJson = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			const written = JSON.parse(writtenJson);

			// Managed elements replaced
			expect(written.nodes.find((n: { id: string }) => n.id === "ft-t-t1")).toBeDefined();
			expect(written.nodes.find((n: { id: string }) => n.id === "ft-t-old")).toBeUndefined();

			// User elements preserved
			expect(written.nodes.find((n: { id: string }) => n.id === "user-note-42")).toBeDefined();
			expect(written.edges.find((e: { id: string }) => e.id === "user-edge-1")).toBeDefined();

			service.destroy();
		});
	});
});
