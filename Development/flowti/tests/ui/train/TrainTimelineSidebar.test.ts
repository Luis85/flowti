// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainTimelineSidebar, computeGraphLayout, LANE_COLORS, LANE_WIDTH } from "../../../src/ui/train/TrainTimelineSidebar";
import { VIEW_TYPE_TRAIN_TIMELINE } from "../../../src/ui/train/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";
import type { TrainService } from "../../../src/domain/train/TrainService";

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
}

function createThought(overrides: Partial<ThoughtNode> = {}): ThoughtNode {
	return {
		id: `thought_${Math.random().toString(36).slice(2, 8)}`,
		trainId: "train_1",
		title: "Test Thought",
		path: "00 - Connectivity/inbox/Test Thought.md",
		createdAt: "2026-02-21T14:30:00.000Z",
		order: 0,
		...overrides,
	};
}

function createTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "My Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 0,
		createdAt: "2026-02-21T14:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		...overrides,
	};
}

function createMockTrainService(train: TrainState | undefined = undefined): TrainService {
	const t1 = createThought({ id: "t1", title: "Initial idea", order: 0 });
	const t2 = createThought({ id: "t2", title: "Schema design", order: 1 });
	const t3 = createThought({ id: "t3", title: "NoSQL branch", order: 2 });
	const t4 = createThought({ id: "t4", title: "API endpoints", order: 3 });
	const defaultTrain = train ?? createTrain({
		thoughts: [t1, t2, t3, t4],
		relations: [
			{ fromId: "t1", toId: "t2", direction: "next" },
			{ fromId: "t2", toId: "t3", direction: "branch" },
			{ fromId: "t2", toId: "t4", direction: "next" },
		],
	});

	return {
		getTrain: vi.fn((id: string) => id === defaultTrain.id ? defaultTrain : undefined),
		getActiveTrain: vi.fn(() => defaultTrain.status !== "completed" ? defaultTrain : undefined),
		getTimeline: vi.fn(() => [t1, t2, t4]),  // Main chain: t1 → t2 → t4
		getBranches: vi.fn((_trainId: string, thoughtId: string) =>
			thoughtId === "t2" ? [t3] : [],
		),
		getChildren: vi.fn((_trainId: string, thoughtId: string) => {
			if (thoughtId === "t1") return [t2];
			if (thoughtId === "t2") return [t3, t4];
			return [];
		}),
		getAllTrains: vi.fn(() => [defaultTrain]),
		getMainChainIds: vi.fn(() => new Set(["t1", "t2", "t4"])),
	} as unknown as TrainService;
}

// ── Tests ────────────────────────────────────────────────

describe("TrainTimelineSidebar", () => {
	let eventBus: EventBus;
	let trainService: TrainService;
	let view: TrainTimelineSidebar;

	beforeEach(() => {
		eventBus = new EventBus();
		trainService = createMockTrainService();
		view = new TrainTimelineSidebar(createMockLeaf(), eventBus, trainService);
	});

	describe("view type", () => {
		it("returns correct view type", () => {
			expect(view.getViewType()).toBe(VIEW_TYPE_TRAIN_TIMELINE);
			expect(view.getViewType()).toBe("flowti-train-timeline");
		});

		it("returns git-branch icon", () => {
			expect(view.getIcon()).toBe("git-branch");
		});

		it("returns default display text when no train", () => {
			const emptyView = new TrainTimelineSidebar(
				createMockLeaf(),
				eventBus,
				createMockTrainService(createTrain({ id: "other", status: "completed" })),
			);
			expect(emptyView.getDisplayText()).toBe("Train Timeline");
		});

		it("returns train title in display text", async () => {
			await view.onOpen();
			expect(view.getDisplayText()).toBe("Timeline: My Train");
		});
	});

	describe("state persistence", () => {
		it("getState returns trainId and activeThoughtId", async () => {
			await view.onOpen();
			expect(view.getState()).toEqual({ trainId: "train_1", activeThoughtId: null });
		});

		it("getState returns nulls when no train", () => {
			expect(view.getState()).toEqual({ trainId: null, activeThoughtId: null });
		});

		it("setState sets trainId and re-renders", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t2" }, { history: false });
			expect(view.getState()).toEqual({ trainId: "train_1", activeThoughtId: "t2" });
		});
	});

	describe("rendering", () => {
		it("shows empty state when no active train", async () => {
			const noTrainService = createMockTrainService(
				createTrain({ id: "none", status: "completed" }),
			);
			(noTrainService.getActiveTrain as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
			(noTrainService.getTrain as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

			const emptyView = new TrainTimelineSidebar(createMockLeaf(), eventBus, noTrainService);
			await emptyView.onOpen();

			const empty = emptyView.contentEl.querySelector(".ft-timeline-empty");
			expect(empty).not.toBeNull();
		});

		it("renders header with train title", async () => {
			await view.onOpen();

			const title = view.contentEl.querySelector(".ft-timeline-title");
			expect(title?.textContent).toBe("My Train");
		});

		it("renders status badge", async () => {
			await view.onOpen();

			const badge = view.contentEl.querySelector(".ft-timeline-status");
			expect(badge?.textContent).toBe("running");
			expect(badge?.classList.contains("ft-timeline-status-running")).toBe(true);
		});

		it("renders graph timeline container", async () => {
			await view.onOpen();

			const container = view.contentEl.querySelector(".ft-graph-timeline");
			expect(container).not.toBeNull();
		});

		it("renders nodes for all thoughts including branches", async () => {
			await view.onOpen();

			const nodes = view.contentEl.querySelectorAll(".ft-timeline-node");
			// Main chain: t1, t2, t4 + branch: t3 = 4 total
			expect(nodes.length).toBe(4);
		});

		it("renders nodes bottom-to-top (newest first)", async () => {
			await view.onOpen();

			const titles = view.contentEl.querySelectorAll(".ft-timeline-node-title");
			expect(titles.length).toBe(4);
			// Reversed order: t4 (newest main), t3 (branch), t2, t1 (root at bottom)
			expect(titles[0].textContent).toBe("API endpoints");
			expect(titles[1].textContent).toBe("NoSQL branch");
			expect(titles[2].textContent).toBe("Schema design");
			expect(titles[3].textContent).toBe("Initial idea");
		});

		it("renders branch nodes with ft-timeline-node-branch class", async () => {
			await view.onOpen();

			const branchNodes = view.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(1);
		});

		it("renders graph dots instead of text bullets", async () => {
			await view.onOpen();

			const dots = view.contentEl.querySelectorAll(".ft-graph-dot");
			expect(dots.length).toBe(4);
		});

		it("renders graph rails for active lanes", async () => {
			await view.onOpen();

			const rails = view.contentEl.querySelectorAll(".ft-graph-rail");
			// Most rows have 1 rail (lane 0). The branch row (t3) has 2 rails (lane 0 + lane 1)
			// 3 rows with 1 rail + 1 row with 2 rails = 5 total
			expect(rails.length).toBe(5);
		});

		it("renders timestamps on each node", async () => {
			await view.onOpen();

			const times = view.contentEl.querySelectorAll(".ft-graph-time");
			expect(times.length).toBe(4);
			for (const time of Array.from(times)) {
				expect(time.textContent).toBeTruthy();
			}
		});

		it("shows empty chain message when no thoughts", async () => {
			const emptyTrain = createTrain({ thoughts: [] });
			const service = createMockTrainService(emptyTrain);
			(service.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([]);

			const emptyView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await emptyView.onOpen();

			const emptyChain = emptyView.contentEl.querySelector(".ft-timeline-empty-chain");
			expect(emptyChain).not.toBeNull();
			expect(emptyChain?.textContent).toBe("No thoughts yet");
		});
	});

	// ── Inc 1: Open Train button ─────────────────────────

	describe("open train button", () => {
		it("renders open train button in header", async () => {
			await view.onOpen();

			const btn = view.contentEl.querySelector(".ft-timeline-open-train-btn");
			expect(btn).not.toBeNull();
			expect((btn as HTMLElement).ariaLabel).toBe("Open train detail");
		});

		it("emits ui.openTrainView with trainId on click", async () => {
			const handler = vi.fn();
			eventBus.on("ui.openTrainView", handler);

			await view.onOpen();

			const btn = view.contentEl.querySelector(".ft-timeline-open-train-btn") as HTMLElement;
			btn.click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({ trainId: "train_1" });
		});

		it("stopPropagation prevents node click", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			const btn = view.contentEl.querySelector(".ft-timeline-open-train-btn") as HTMLElement;
			btn.click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Active node highlighting ─────────────────────────

	describe("active node highlighting", () => {
		it("highlights active thought node", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t2" }, { history: false });

			const activeNodes = view.contentEl.querySelectorAll(".ft-timeline-node-active");
			expect(activeNodes.length).toBe(1);
		});

		it("shows active dot for active node", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t1" }, { history: false });

			const activeDots = view.contentEl.querySelectorAll(".ft-graph-dot-active");
			expect(activeDots.length).toBe(1);
		});

		it("shows normal dots for inactive nodes", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t1" }, { history: false });

			const normalDots = view.contentEl.querySelectorAll(".ft-graph-dot:not(.ft-graph-dot-active)");
			// 3 inactive nodes out of 4 total
			expect(normalDots.length).toBe(3);
		});
	});

	// ── Click navigation ─────────────────────────────────

	describe("click navigation", () => {
		it("emits train.thought.activated on node click", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			// In bottom-to-top order: [t4, t3, t2, t1]
			// Click t2 (index 2 in reversed order)
			const nodes = view.contentEl.querySelectorAll(".ft-timeline-node");
			(nodes[2] as HTMLElement).click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({
				trainId: "train_1",
				thoughtId: "t2",
			});
		});

		it("updates active node on click", async () => {
			await view.onOpen();

			const nodes = view.contentEl.querySelectorAll(".ft-timeline-node");
			(nodes[2] as HTMLElement).click();

			const activeNodes = view.contentEl.querySelectorAll(".ft-timeline-node-active");
			expect(activeNodes.length).toBe(1);
		});

		it("clicking branch node emits correct thoughtId", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			// Branch node is t3 (index 1 in reversed: [t4, t3, t2, t1])
			const branchNode = view.contentEl.querySelector(".ft-timeline-node-branch") as HTMLElement;
			branchNode.click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.thoughtId).toBe("t3");
		});
	});

	// ── Event subscriptions ──────────────────────────────

	describe("event subscriptions", () => {
		it("re-renders on train.thought.added", async () => {
			await view.onOpen();

			await eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: createThought({ id: "t5", title: "New Thought", order: 4 }),
				previousTitle: "API endpoints",
				direction: "next" as const,
			});

			await new Promise((r) => setTimeout(r, 30));

			expect(trainService.getTrain).toHaveBeenCalled();
		});

		it("re-renders on train.paused", async () => {
			await view.onOpen();
			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

			await eventBus.emit("train.paused", { trainId: "train_1" });
			await new Promise((r) => setTimeout(r, 30));

			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
		});

		it("re-renders on train.completed", async () => {
			await view.onOpen();
			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

			await eventBus.emit("train.completed", { trainId: "train_1", thoughtCount: 4 });
			await new Promise((r) => setTimeout(r, 30));

			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
		});

		it("highlights node on train.thought.activated", async () => {
			await view.onOpen();

			await eventBus.emit("train.thought.activated", {
				trainId: "train_1",
				thoughtId: "t4",
			});

			await new Promise((r) => setTimeout(r, 30));

			const activeNodes = view.contentEl.querySelectorAll(".ft-timeline-node-active");
			expect(activeNodes.length).toBe(1);
		});

		it("switches train on train.started", async () => {
			await view.onOpen();

			const newTrain = createTrain({ id: "train_2", title: "New Train" });
			await eventBus.emit("train.started", { train: newTrain });
			await new Promise((r) => setTimeout(r, 30));

			expect(view.getState().trainId).toBe("train_2");
		});

		it("ignores events for different trains", async () => {
			await view.onOpen();
			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

			await eventBus.emit("train.paused", { trainId: "other_train" });
			await new Promise((r) => setTimeout(r, 30));

			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
		});

		it("cleans up subscriptions on close", async () => {
			await view.onOpen();

			await view.onClose();

			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;
			await eventBus.emit("train.paused", { trainId: "train_1" });
			await new Promise((r) => setTimeout(r, 30));

			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
		});
	});

	// ── Git Graph structure ──────────────────────────────

	describe("graph structure", () => {
		it("renders graph cells with lane rails", async () => {
			await view.onOpen();

			const cells = view.contentEl.querySelectorAll(".ft-graph-cell");
			expect(cells.length).toBe(4);
		});

		it("renders fork connector on branch start", async () => {
			await view.onOpen();

			const forks = view.contentEl.querySelectorAll(".ft-graph-fork");
			expect(forks.length).toBe(1); // t3 is the only branch start
		});

		it("fork connector spans from parent lane to branch lane", async () => {
			await view.onOpen();

			const fork = view.contentEl.querySelector(".ft-graph-fork") as HTMLElement;
			// Parent lane 0 center: 0 * 20 + 10 = 10
			// Branch lane 1 center: 1 * 20 + 10 = 30
			expect(fork.style.left).toBe(`${0 * LANE_WIDTH + LANE_WIDTH / 2}px`);
			expect(fork.style.width).toBe(`${LANE_WIDTH}px`);
		});

		it("renders branch count badge (+N)", async () => {
			await view.onOpen();

			// t2 has 1 branch (t3)
			const badges = view.contentEl.querySelectorAll(".ft-timeline-branch-badge");
			expect(badges.length).toBe(1);
			expect(badges[0].textContent).toBe("+1");
		});

		it("does not render fork connector on main chain nodes", async () => {
			await view.onOpen();

			const mainNodes = view.contentEl.querySelectorAll(".ft-timeline-node:not(.ft-timeline-node-branch)");
			for (const node of Array.from(mainNodes)) {
				const fork = node.querySelector(".ft-graph-fork");
				expect(fork).toBeNull();
			}
		});

		it("auto-scrolls active node into view", async () => {
			const scrollSpy = vi.fn();
			HTMLElement.prototype.scrollIntoView = scrollSpy;

			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t4" }, { history: false });

			await new Promise((r) => setTimeout(r, 10));

			expect(scrollSpy).toHaveBeenCalled();
		});

		it("renders merge connector when branch is merged back to main chain", async () => {
			const t1 = createThought({ id: "t1", title: "Root", order: 0 });
			const t2 = createThought({ id: "t2", title: "Main Next", order: 1 });
			const b1 = createThought({ id: "b1", title: "Branch", order: 2 });
			const train = createTrain({
				thoughts: [t1, t2, b1],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "next" },
					{ fromId: "t1", toId: "b1", direction: "branch" },
					{ fromId: "b1", toId: "t2", direction: "merge" },
				],
			});
			const service = createMockTrainService(train);
			(service.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
			(service.getBranches as ReturnType<typeof vi.fn>).mockImplementation(
				(_trainId: string, thoughtId: string) => thoughtId === "t1" ? [b1] : [],
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const mergeConnectors = treeView.contentEl.querySelectorAll(".ft-graph-merge");
			expect(mergeConnectors.length).toBe(1);

			// Connector spans from main chain lane (0) to branch lane (1)
			const connector = mergeConnectors[0] as HTMLElement;
			const fromX = 0 * LANE_WIDTH + LANE_WIDTH / 2;
			const toX = 1 * LANE_WIDTH + LANE_WIDTH / 2;
			expect(connector.style.left).toBe(`${fromX}px`);
			expect(connector.style.width).toBe(`${toX - fromX}px`);
		});

		it("does not render merge connector for non-merged branches", async () => {
			await view.onOpen();

			const mergeConnectors = view.contentEl.querySelectorAll(".ft-graph-merge");
			expect(mergeConnectors.length).toBe(0);
		});

		it("renders multiple fork connectors for sibling branches", async () => {
			const t1 = createThought({ id: "t1", title: "Root", order: 0 });
			const t2 = createThought({ id: "t2", title: "Second", order: 1 });
			const t3a = createThought({ id: "t3a", title: "Branch A", order: 2 });
			const t3b = createThought({ id: "t3b", title: "Branch B", order: 3 });
			const train = createTrain({
				thoughts: [t1, t2, t3a, t3b],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "next" },
					{ fromId: "t2", toId: "t3a", direction: "branch" },
					{ fromId: "t2", toId: "t3b", direction: "branch" },
				],
			});
			const service = createMockTrainService(train);
			(service.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
			(service.getBranches as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => thoughtId === "t2" ? [t3a, t3b] : [],
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const forks = treeView.contentEl.querySelectorAll(".ft-graph-fork");
			expect(forks.length).toBe(2); // Both branch starts get fork connectors
		});

		it("renders sub-branches at increasing lane depth", async () => {
			const t1 = createThought({ id: "t1", title: "Root", order: 0 });
			const t2 = createThought({ id: "t2", title: "Main", order: 1 });
			const t3 = createThought({ id: "t3", title: "Branch", order: 2 });
			const t4 = createThought({ id: "t4", title: "Sub-branch", order: 3 });
			const train = createTrain({
				thoughts: [t1, t2, t3, t4],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "next" },
					{ fromId: "t2", toId: "t3", direction: "branch" },
					{ fromId: "t3", toId: "t4", direction: "branch" },
				],
			});
			const service = createMockTrainService(train);
			(service.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
			(service.getBranches as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => {
					if (thoughtId === "t2") return [t3];
					if (thoughtId === "t3") return [t4];
					return [];
				},
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const branchNodes = treeView.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(2); // t3 at lane 1, t4 at lane 2

			const forks = treeView.contentEl.querySelectorAll(".ft-graph-fork");
			expect(forks.length).toBe(2);
		});

		it("limits recursion depth to 5 lanes", async () => {
			const thoughts: ThoughtNode[] = [];
			const rels: ThoughtRelation[] = [];
			const root = createThought({ id: "root", title: "Root", order: 0 });
			thoughts.push(root);

			let prevId = "root";
			for (let i = 1; i <= 7; i++) {
				const t = createThought({ id: `b${i}`, title: `Branch-${i}`, order: i });
				thoughts.push(t);
				rels.push({ fromId: prevId, toId: t.id, direction: "branch" });
				prevId = t.id;
			}

			const train = createTrain({ thoughts, relations: rels });
			const service = createMockTrainService(train);
			(service.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([root]);
			(service.getBranches as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => {
					const rel = rels.find((r) => r.fromId === thoughtId);
					if (!rel) return [];
					return [thoughts.find((t) => t.id === rel.toId)!];
				},
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const branchNodes = treeView.contentEl.querySelectorAll(".ft-timeline-node-branch");
			// Root at lane 0, then b1-b5 at lanes 1-5 = 5 branch nodes (b6 and b7 capped)
			expect(branchNodes.length).toBe(5);
		});
	});

	// ── Collapse/Expand ──────────────────────────────────

	describe("collapse/expand", () => {
		it("renders chevron on nodes with branches", async () => {
			await view.onOpen();

			const chevrons = view.contentEl.querySelectorAll(".ft-timeline-chevron");
			// t2 has a branch (t3), so 1 chevron expected
			expect(chevrons.length).toBe(1);
			expect(chevrons[0].textContent).toBe("▾"); // Expanded by default
		});

		it("collapses branches when chevron clicked", async () => {
			await view.onOpen();

			const chevron = view.contentEl.querySelector(".ft-timeline-chevron") as HTMLElement;
			chevron.click();

			// After click, branch node should be hidden
			const branchNodes = view.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(0);

			// Chevron should show collapsed state
			const newChevron = view.contentEl.querySelector(".ft-timeline-chevron");
			expect(newChevron?.textContent).toBe("▸");
		});

		it("expands branches when collapsed chevron clicked again", async () => {
			await view.onOpen();

			// Collapse
			const chevron = view.contentEl.querySelector(".ft-timeline-chevron") as HTMLElement;
			chevron.click();

			// Expand
			const chevron2 = view.contentEl.querySelector(".ft-timeline-chevron") as HTMLElement;
			chevron2.click();

			// Branch should be visible again
			const branchNodes = view.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(1);
		});

		it("chevron click does not trigger node click (stopPropagation)", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			const chevron = view.contentEl.querySelector(".ft-timeline-chevron") as HTMLElement;
			chevron.click();

			await new Promise((r) => setTimeout(r, 0));

			// train.thought.activated should NOT have been emitted
			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── Stat line ────────────────────────────────────────

	describe("stat line", () => {
		it("renders compact stat line in header", async () => {
			await view.onOpen();

			const statLine = view.contentEl.querySelector(".ft-timeline-stat-line");
			expect(statLine).not.toBeNull();
			expect(statLine?.textContent).toContain("thoughts");
			expect(statLine?.textContent).toContain("branches");
			expect(statLine?.textContent).toContain("min");
		});

		it("shows correct thought count in stat line", async () => {
			await view.onOpen();

			const statLine = view.contentEl.querySelector(".ft-timeline-stat-line");
			expect(statLine?.textContent).toContain("4 thoughts");
		});

		it("shows branch count in stat line", async () => {
			await view.onOpen();

			const statLine = view.contentEl.querySelector(".ft-timeline-stat-line");
			expect(statLine?.textContent).toContain("1 branches");
		});
	});
});

// ── computeGraphLayout (pure function) ──────────────────

describe("computeGraphLayout", () => {
	function thought(id: string, title: string, order: number): ThoughtNode {
		return {
			id, trainId: "train_1", title, path: `${title}.md`,
			createdAt: "2026-02-21T14:30:00.000Z", order,
		};
	}

	it("returns empty array for empty timeline", () => {
		const train = { id: "t", thoughts: [], relations: [] } as unknown as TrainState;
		const rows = computeGraphLayout([], train, () => [], new Set());
		expect(rows).toEqual([]);
	});

	it("assigns lane 0 to main chain", () => {
		const t1 = thought("t1", "First", 0);
		const t2 = thought("t2", "Second", 1);
		const train = {
			id: "t", thoughts: [t1, t2],
			relations: [{ fromId: "t1", toId: "t2", direction: "next" }],
		} as unknown as TrainState;

		const rows = computeGraphLayout([t1, t2], train, () => [], new Set());
		expect(rows.length).toBe(2);
		expect(rows[0].lane).toBe(0);
		expect(rows[1].lane).toBe(0);
		expect(rows[0].isBranchStart).toBe(false);
	});

	it("assigns lane 1 to first branch", () => {
		const t1 = thought("t1", "Root", 0);
		const t2 = thought("t2", "Main", 1);
		const b1 = thought("b1", "Branch", 2);
		const train = {
			id: "t", thoughts: [t1, t2, b1],
			relations: [
				{ fromId: "t1", toId: "t2", direction: "next" },
				{ fromId: "t1", toId: "b1", direction: "branch" },
			],
		} as unknown as TrainState;

		const getBranches = (_tid: string, nid: string) => nid === "t1" ? [b1] : [];
		const rows = computeGraphLayout([t1, t2], train, getBranches, new Set());

		expect(rows.length).toBe(3); // t1, b1, t2
		expect(rows[0].lane).toBe(0); // t1
		expect(rows[1].lane).toBe(1); // b1 (branch)
		expect(rows[1].isBranchStart).toBe(true);
		expect(rows[1].parentLane).toBe(0);
		expect(rows[2].lane).toBe(0); // t2 (main chain continues)
	});

	it("tracks active lanes correctly", () => {
		const t1 = thought("t1", "Root", 0);
		const b1 = thought("b1", "Branch", 1);
		const t2 = thought("t2", "Main", 2);
		const train = {
			id: "t", thoughts: [t1, b1, t2],
			relations: [
				{ fromId: "t1", toId: "t2", direction: "next" },
				{ fromId: "t1", toId: "b1", direction: "branch" },
			],
		} as unknown as TrainState;

		const getBranches = (_tid: string, nid: string) => nid === "t1" ? [b1] : [];
		const rows = computeGraphLayout([t1, t2], train, getBranches, new Set());

		// t1: only lane 0 active
		expect(rows[0].activeLanes.has(0)).toBe(true);
		expect(rows[0].activeLanes.has(1)).toBe(false);

		// b1 (branch): lane 0 + lane 1 active
		expect(rows[1].activeLanes.has(0)).toBe(true);
		expect(rows[1].activeLanes.has(1)).toBe(true);

		// t2 (after branch ends): only lane 0 active
		expect(rows[2].activeLanes.has(0)).toBe(true);
		expect(rows[2].activeLanes.has(1)).toBe(false);
	});

	it("respects collapsed nodes", () => {
		const t1 = thought("t1", "Root", 0);
		const b1 = thought("b1", "Branch", 1);
		const train = {
			id: "t", thoughts: [t1, b1],
			relations: [{ fromId: "t1", toId: "b1", direction: "branch" }],
		} as unknown as TrainState;

		const getBranches = (_tid: string, nid: string) => nid === "t1" ? [b1] : [];
		const collapsed = new Set(["t1"]);
		const rows = computeGraphLayout([t1], train, getBranches, collapsed);

		// Only t1 in layout — branch b1 is suppressed
		expect(rows.length).toBe(1);
		expect(rows[0].thought.id).toBe("t1");
	});

	it("assigns increasing lanes to nested branches", () => {
		const t1 = thought("t1", "Root", 0);
		const b1 = thought("b1", "Branch L1", 1);
		const b2 = thought("b2", "Branch L2", 2);
		const train = {
			id: "t", thoughts: [t1, b1, b2],
			relations: [
				{ fromId: "t1", toId: "b1", direction: "branch" },
				{ fromId: "b1", toId: "b2", direction: "branch" },
			],
		} as unknown as TrainState;

		const getBranches = (_tid: string, nid: string) => {
			if (nid === "t1") return [b1];
			if (nid === "b1") return [b2];
			return [];
		};
		const rows = computeGraphLayout([t1], train, getBranches, new Set());

		expect(rows[0].lane).toBe(0); // t1
		expect(rows[1].lane).toBe(1); // b1
		expect(rows[2].lane).toBe(2); // b2
	});

	it("uses LANE_COLORS for lane coloring", () => {
		const t1 = thought("t1", "Root", 0);
		const train = {
			id: "t", thoughts: [t1], relations: [],
		} as unknown as TrainState;

		const rows = computeGraphLayout([t1], train, () => [], new Set());
		expect(rows[0].activeLanes.get(0)).toBe(LANE_COLORS[0]);
	});

	it("caps depth at 5 lanes", () => {
		const thoughts: ThoughtNode[] = [];
		const rels: { fromId: string; toId: string; direction: string }[] = [];
		let prevId = "root";
		for (let i = 0; i <= 7; i++) {
			const t = thought(i === 0 ? "root" : `b${i}`, `N${i}`, i);
			thoughts.push(t);
			if (i > 0) {
				rels.push({ fromId: prevId, toId: t.id, direction: "branch" });
				prevId = t.id;
			}
		}

		const train = { id: "t", thoughts, relations: rels } as unknown as TrainState;
		const getBranches = (_tid: string, nid: string) => {
			const rel = rels.find((r) => r.fromId === nid);
			return rel ? [thoughts.find((t) => t.id === rel.toId)!] : [];
		};

		const rows = computeGraphLayout([thoughts[0]], train, getBranches, new Set());
		// root(0) + b1(1) + b2(2) + b3(3) + b4(4) + b5(5) = 6 nodes (b6, b7 capped)
		expect(rows.length).toBe(6);
		expect(rows[5].lane).toBe(5);
	});
});
