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
		it("renders header with train title when train exists", () => {
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

			const title = container.querySelector(".ft-train-title");
			expect(title).not.toBeNull();
			expect(title!.textContent).toContain("Train: My Brainstorm");
		});

		it("renders status badge", () => {
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

			const badge = container.querySelector(".ft-train-status");
			expect(badge).not.toBeNull();
			expect(badge!.textContent).toBe("running");
		});

		it("renders nav bar with prev/next buttons when train has thoughts", () => {
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

			const prevBtn = container.querySelector(".ft-train-prev-btn");
			expect(prevBtn).not.toBeNull();
			// First thought is active by default, so prev should be disabled
			expect((prevBtn as HTMLButtonElement).disabled).toBe(true);

			// Should have a next button or jump-to-end button
			const nextBtn = container.querySelector(".ft-train-next-btn");
			const jumpBtn = container.querySelector(".ft-train-jump-to-end-btn");
			expect(nextBtn ?? jumpBtn).not.toBeNull();
		});

		it("renders stats section for active train", () => {
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

			const statsSection = container.querySelector(".ft-train-stats-section");
			expect(statsSection).not.toBeNull();
		});

		it("renders thought detail when active thought exists", () => {
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

			const thoughtTitle = container.querySelector(".ft-train-thought-title");
			expect(thoughtTitle).not.toBeNull();
			expect(thoughtTitle!.textContent).toBe("My Insight");
		});

		it("renders breadcrumb section", () => {
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

			const breadcrumbSection = container.querySelector(".ft-train-breadcrumb-section");
			expect(breadcrumbSection).not.toBeNull();
		});
	});

	describe("completed train rendering", () => {
		it("renders completion callout when train is completed", () => {
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

			const callout = container.querySelector(".ft-train-completion-callout");
			expect(callout).not.toBeNull();

			const headingEl = callout!.querySelector(".ft-heading-sm");
			expect(headingEl).not.toBeNull();
			expect(headingEl!.textContent).toBe("Ride complete");
		});

		it("renders stats panel in completed state", () => {
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

			const statsSection = container.querySelector(".ft-train-stats-section");
			expect(statsSection).not.toBeNull();
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

			// Completed trains skip the nav bar entirely
			const navBar = container.querySelector(".ft-train-nav-bar");
			expect(navBar).toBeNull();
		});

		it("renders a 'Start a new ride' CTA button", () => {
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

			const ctaButton = container.querySelector(".ft-btn-primary");
			expect(ctaButton).not.toBeNull();
			expect(ctaButton!.textContent).toBe("Start a new ride");
		});
	});

	describe("train action buttons", () => {
		it("renders Pause and Complete buttons for running train", () => {
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

			const buttons = container.querySelectorAll(".ft-detail-actions button");
			expect(buttons.length).toBe(2);
			const texts = Array.from(buttons).map((b) => b.textContent?.trim());
			expect(texts).toContain("Pause");
			expect(texts).toContain("Complete");
		});

		it("renders Resume and Complete buttons for paused train", () => {
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

			const buttons = container.querySelectorAll(".ft-detail-actions button");
			expect(buttons.length).toBe(2);
			const texts = Array.from(buttons).map((b) => b.textContent?.trim());
			expect(texts).toContain("Resume");
			expect(texts).toContain("Complete");
		});

		it("emits ui.startTrain when 'Start a new ride' CTA is clicked", () => {
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

			const ctaButton = container.querySelector(".ft-btn-primary") as HTMLButtonElement;
			ctaButton.click();
			expect(eventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
		});

		it("renders Add Thought button when at the end of the chain", () => {
			const thought = createThought({ id: "t1" });
			const train = createTrain({
				status: "running",
				thoughts: [thought],
			});
			// Head node is the same as active thought, no next relation
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

			const addBtn = container.querySelector(".ft-train-add-thought-btn");
			expect(addBtn).not.toBeNull();
			expect(addBtn!.textContent).toContain("Add Thought");
		});

		it("renders branch links when thought has branches", () => {
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

			const branchSection = container.querySelector(".ft-train-branches");
			expect(branchSection).not.toBeNull();

			const branchLink = container.querySelector(".ft-train-branch-link");
			expect(branchLink).not.toBeNull();
			expect(branchLink!.textContent).toContain("Branch Idea");
		});

		it("renders parent train link when parentTrainId exists", () => {
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

			const parentLink = container.querySelector(".ft-train-parent-link");
			expect(parentLink).not.toBeNull();
			expect(parentLink!.textContent).toContain("Parent: Parent Train");
		});

		it("renders toggle timeline sidebar button in header", () => {
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

			// The toggle button is a ghost button inside the header section (after the spacer)
			const ghostButtons = container.querySelectorAll(".ft-btn-ghost.ft-btn-sm");
			// Find the toggle button (it's in the header, not in the nav bar)
			const headerSection = container.querySelector(".ft-section");
			const toggleBtn = headerSection?.querySelector(".ft-btn-ghost.ft-btn-sm") as HTMLButtonElement | null;
			expect(toggleBtn).not.toBeNull();

			toggleBtn!.click();
			expect(eventBus.emit).toHaveBeenCalledWith("ui.toggleTrainTimeline", { trainId: "train-1" });
		});
	});

	describe("merge section", () => {
		it("renders merge section with undo button when thought has outgoing merges", () => {
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

			const mergeSection = container.querySelector(".ft-train-merge-section");
			expect(mergeSection).not.toBeNull();

			const undoBtn = container.querySelector(".ft-train-merge-undo");
			expect(undoBtn).not.toBeNull();
		});
	});

	describe("type badge", () => {
		it("renders type badge with correct label", () => {
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

			const typeBadge = container.querySelector(".ft-train-type-badge");
			expect(typeBadge).not.toBeNull();
			expect(typeBadge!.textContent).toContain("Brainstorm");
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

			const typeBadge = container.querySelector(".ft-train-type-badge");
			expect(typeBadge).not.toBeNull();
			expect(typeBadge!.textContent).toContain("Free-form");
		});
	});
});
