// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTrainMainHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/train-main-handler";
import type { TrainMainHandlerDeps } from "../../../../src/infrastructure/handlers/leaf-handlers/train-main-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../../src/domain/train/types";

// ── Factories ─────────────────────────────────────────────────

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createMockTrainService() {
	return {
		getTrain: vi.fn<(id: string) => TrainState | undefined>(() => undefined),
		getActiveTrain: vi.fn<() => TrainState | undefined>(() => undefined),
		getAllTrains: vi.fn<() => readonly TrainState[]>(() => []),
		getTimeline: vi.fn<(trainId: string) => ThoughtNode[]>(() => []),
		getBranches: vi.fn<(trainId: string, thoughtId: string) => ThoughtNode[]>(() => []),
		getChildren: vi.fn<(trainId: string, thoughtId: string) => ThoughtNode[]>(() => []),
		getMainChainIds: vi.fn<(trainId: string) => Set<string>>(() => new Set()),
		getHeadNode: vi.fn<(trainId: string) => ThoughtNode | null>(() => null),
		findMergeDownTarget: vi.fn(() => null),
		pause: vi.fn().mockResolvedValue(true),
		resume: vi.fn().mockResolvedValue(true),
		completeTrain: vi.fn().mockResolvedValue(true),
		renameTrain: vi.fn().mockResolvedValue(true),
		deleteTrain: vi.fn().mockResolvedValue(true),
		undoMerge: vi.fn().mockResolvedValue(true),
		startTrain: vi.fn().mockResolvedValue(undefined),
		addThought: vi.fn().mockResolvedValue(null),
		renameThought: vi.fn().mockResolvedValue(true),
		mergeBranch: vi.fn().mockResolvedValue(true),
		getMerges: vi.fn<(trainId: string) => ThoughtRelation[]>(() => []),
		setBranchStatus: vi.fn().mockResolvedValue(true),
		clearBranchStatus: vi.fn().mockResolvedValue(true),
		load: vi.fn().mockResolvedValue(undefined),
		getSettings: vi.fn(() => ({ trainFolder: "", trainMaxThoughts: 100 })),
	};
}

function createThought(overrides: Partial<ThoughtNode> = {}): ThoughtNode {
	return {
		id: "thought-1",
		trainId: "train-1",
		title: "First thought",
		path: "trains/first-thought.md",
		createdAt: new Date().toISOString(),
		order: 0,
		...overrides,
	};
}

function createTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train-1",
		sessionId: "session-1",
		title: "Test Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 25,
		createdAt: new Date().toISOString(),
		pausedAt: null,
		completedAt: null,
		folderPath: "trains/test-train",
		...overrides,
	};
}

function createDeps(overrides: Partial<TrainMainHandlerDeps> = {}): TrainMainHandlerDeps {
	return {
		trainService: createMockTrainService() as never,
		eventBus: createMockEventBus(),
		app: {},
		getTrainSettings: () => ({
			trainFolder: "trains",
			trainCanvasEnabled: true,
			trainCanvasAutoOpen: false,
		}),
		...overrides,
	};
}

/** Helper to get the Lit workspace element from the container. */
function getWorkspaceEl(container: HTMLElement): HTMLElement & Record<string, unknown> {
	return container.querySelector("flowti-train-workspace") as HTMLElement & Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────

describe("registerTrainMainHandler", () => {
	let registry: PluginHandlerRegistry;
	let deps: TrainMainHandlerDeps;
	let eventBus: IEventBus;
	let trainService: ReturnType<typeof createMockTrainService>;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		trainService = createMockTrainService();
		eventBus = createMockEventBus();
		deps = createDeps({ trainService: trainService as never, eventBus });
		registerTrainMainHandler(registry, deps);
	});

	it("registers the leaf:train-main tab handler", () => {
		expect(registry.getTabHandler("leaf:train-main")).toBeDefined();
	});

	describe("empty state (no train)", () => {
		it("renders history panel when no train exists", () => {
			trainService.getActiveTrain.mockReturnValue(undefined);
			trainService.getAllTrains.mockReturnValue([]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const emptyEl = container.querySelector(".ft-train-empty");
			expect(emptyEl).not.toBeNull();

			// History panel renders its header
			const historyHeader = container.querySelector(".ft-train-history");
			expect(historyHeader).not.toBeNull();
		});

		it("renders history panel with train cards when trains exist but none is focused", () => {
			const completedTrain = createTrain({
				id: "train-old",
				status: "completed",
				completedAt: new Date().toISOString(),
			});
			trainService.getActiveTrain.mockReturnValue(undefined);
			trainService.getAllTrains.mockReturnValue([completedTrain]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const card = container.querySelector(".ft-train-history-card");
			expect(card).not.toBeNull();
		});
	});

	describe("active train rendering", () => {
		it("sets train property on workspace element", () => {
			const train = createTrain({ title: "My Brainstorm" });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);
			trainService.getHeadNode.mockReturnValue(null);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace).not.toBeNull();
			expect((workspace.train as TrainState).title).toBe("My Brainstorm");
		});

		it("sets train status on workspace element", () => {
			const train = createTrain({ status: "running" });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);
			trainService.getHeadNode.mockReturnValue(null);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect((workspace.train as TrainState).status).toBe("running");
		});

		it("sets navigation properties with prev/next thoughts", () => {
			const thought1 = createThought({ id: "t1", order: 0, title: "First" });
			const thought2 = createThought({ id: "t2", order: 1, title: "Second" });
			const train = createTrain({
				thoughts: [thought1, thought2],
				relations: [{ fromId: "t1", toId: "t2", direction: "next" }],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought1, thought2]);
			trainService.getHeadNode.mockReturnValue(thought2);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace).not.toBeNull();
			// Active thought defaults to first in sorted order
			expect((workspace.activeThought as ThoughtNode).id).toBe("t1");
			// Next thought should be t2
			expect((workspace.nextThought as ThoughtNode).id).toBe("t2");
		});

		it("sets chainLength and branchCount stats", () => {
			const thought = createThought();
			const train = createTrain({ thoughts: [thought] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace.chainLength).toBe(1);
			expect(workspace.branchCount).toBe(0);
		});

		it("sets activeThought property", () => {
			const thought = createThought({ title: "My Insight" });
			const train = createTrain({ thoughts: [thought] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect((workspace.activeThought as ThoughtNode).title).toBe("My Insight");
		});

		it("sets breadcrumbPath property", () => {
			const thought = createThought();
			const train = createTrain({ thoughts: [thought] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(Array.isArray(workspace.breadcrumbPath)).toBe(true);
			expect((workspace.breadcrumbPath as ThoughtNode[]).length).toBeGreaterThan(0);
		});
	});

	describe("completed train rendering", () => {
		it("sets train status to completed on workspace element", () => {
			const thought = createThought();
			const train = createTrain({
				status: "completed",
				completedAt: new Date().toISOString(),
				thoughts: [thought],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect((workspace.train as TrainState).status).toBe("completed");
		});

		it("sets chainLength stat for completed train", () => {
			const thought = createThought();
			const train = createTrain({
				status: "completed",
				completedAt: new Date().toISOString(),
				thoughts: [thought],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace.chainLength).toBe(1);
		});

		it("does NOT render nav bar when train is completed", () => {
			const thought = createThought();
			const train = createTrain({
				status: "completed",
				completedAt: new Date().toISOString(),
				thoughts: [thought],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			// Completed trains skip the nav bar entirely — the Lit component
			// receives the train with completed status and renders accordingly
			const navBar = container.querySelector(".ft-train-nav-bar");
			expect(navBar).toBeNull();
		});

		it("creates workspace element for completed train", () => {
			const train = createTrain({
				status: "completed",
				completedAt: new Date().toISOString(),
				thoughts: [createThought()],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace).not.toBeNull();
		});
	});

	describe("train action buttons", () => {
		it("wires pause-train event handler on workspace element", () => {
			const thought = createThought();
			const train = createTrain({ status: "running", thoughts: [thought] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			workspace.dispatchEvent(new CustomEvent("pause-train"));
			expect(trainService.pause).toHaveBeenCalledWith("train-1");
		});

		it("wires resume-train event handler on workspace element", () => {
			const thought = createThought();
			const train = createTrain({ status: "paused", thoughts: [thought] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			workspace.dispatchEvent(new CustomEvent("resume-train", { detail: {} }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.startTrain", expect.any(Object));
		});

		it("wires start-train event handler on workspace element", () => {
			const train = createTrain({
				status: "completed",
				completedAt: new Date().toISOString(),
				thoughts: [createThought()],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			workspace.dispatchEvent(new CustomEvent("start-train"));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
		});

		it("wires add-thought event handler on workspace element", () => {
			const thought = createThought({ id: "t1" });
			const train = createTrain({
				status: "running",
				thoughts: [thought],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			workspace.dispatchEvent(new CustomEvent("add-thought", { detail: {} }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.startTrain", expect.any(Object));
		});

		it("sets branches property when thought has branches", () => {
			const thought = createThought({ id: "t1" });
			const branch = createThought({ id: "b1", title: "Branch Idea" });
			const train = createTrain({
				status: "running",
				thoughts: [thought, branch],
				relations: [{ fromId: "t1", toId: "b1", direction: "branch" }],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);
			trainService.getBranches.mockReturnValue([branch]);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			const branches = workspace.branches as ThoughtNode[];
			expect(branches).toHaveLength(1);
			expect(branches[0].title).toBe("Branch Idea");
		});

		it("sets parentTrainTitle when parentTrainId exists", () => {
			const parentTrain = createTrain({ id: "parent-1", title: "Parent Train" });
			const thought = createThought();
			const train = createTrain({
				thoughts: [thought],
				parentTrainId: "parent-1",
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockImplementation((id) => {
				if (id === "parent-1") return parentTrain;
				return train;
			});
			trainService.getTimeline.mockReturnValue([thought]);
			trainService.getHeadNode.mockReturnValue(thought);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace.parentTrainTitle).toBe("Parent Train");
			expect(workspace.parentTrainId).toBe("parent-1");
		});

		it("wires toggle-timeline event handler on workspace element", () => {
			const train = createTrain({ thoughts: [createThought()] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);
			trainService.getHeadNode.mockReturnValue(null);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			workspace.dispatchEvent(new CustomEvent("toggle-timeline", { detail: { trainId: "train-1" } }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.toggleTrainTimeline", { trainId: "train-1" });
		});
	});

	describe("merge section", () => {
		it("sets outgoingMerges property when thought has outgoing merges", () => {
			const thought1 = createThought({ id: "t1", title: "Source" });
			const thought2 = createThought({ id: "t2", title: "Target" });
			const train = createTrain({
				status: "running",
				thoughts: [thought1, thought2],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "merge" },
				],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([thought1, thought2]);
			trainService.getHeadNode.mockReturnValue(thought1);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			const merges = workspace.outgoingMerges as Array<{ fromId: string; toId: string; targetTitle: string }>;
			expect(merges).toHaveLength(1);
			expect(merges[0].toId).toBe("t2");
			expect(merges[0].targetTitle).toBe("Target");
		});
	});

	describe("type badge", () => {
		it("sets trainTypeLabel with correct label", () => {
			const train = createTrain({
				trainType: "brainstorm",
				thoughts: [createThought()],
			});
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);
			trainService.getHeadNode.mockReturnValue(null);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace.trainTypeLabel).toBe("Brainstorm");
		});

		it("falls back to Free-form when no type is set", () => {
			const train = createTrain({ thoughts: [createThought()] });
			trainService.getActiveTrain.mockReturnValue(train);
			trainService.getTrain.mockReturnValue(train);
			trainService.getTimeline.mockReturnValue([]);
			trainService.getHeadNode.mockReturnValue(null);

			const container = document.createElement("div");
			registry.getTabHandler("leaf:train-main")!(container, {
				tabId: "train-main",
				viewId: "test",
				eventBus,
			});

			const workspace = getWorkspaceEl(container);
			expect(workspace.trainTypeLabel).toBe("Free-form");
		});
	});
});
