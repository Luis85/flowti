// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainTimelineSidebar } from "../../../src/ui/train/TrainTimelineSidebar";
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

		it("renders timeline container", async () => {
			await view.onOpen();

			const container = view.contentEl.querySelector(".ft-timeline-container");
			expect(container).not.toBeNull();
		});

		it("renders nodes for main chain thoughts", async () => {
			await view.onOpen();

			const nodes = view.contentEl.querySelectorAll(".ft-timeline-node");
			// Main chain: t1, t2, t4 = 3 main nodes + 1 branch (t3) = 4 total
			expect(nodes.length).toBe(4);
		});

		it("renders branch nodes with indentation", async () => {
			await view.onOpen();

			const branchNodes = view.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(1);

			// Branch node should have padding
			const branchNode = branchNodes[0] as HTMLElement;
			expect(branchNode.style.paddingLeft).toBe("16px");
		});

		it("renders tree connectors on branch nodes", async () => {
			await view.onOpen();

			const connectors = view.contentEl.querySelectorAll(".ft-timeline-connector");
			expect(connectors.length).toBe(1);
			// Single branch is last child, so uses └─
			expect(connectors[0].textContent).toBe("└─");
		});

		it("renders thought titles on nodes", async () => {
			await view.onOpen();

			const titles = view.contentEl.querySelectorAll(".ft-timeline-node-title");
			expect(titles.length).toBe(4);
			expect(titles[0].textContent).toBe("Initial idea");
			expect(titles[1].textContent).toBe("Schema design");
			// Node 2 is the branch (NoSQL branch), Node 3 is API endpoints
			expect(titles[2].textContent).toBe("NoSQL branch");
			expect(titles[3].textContent).toBe("API endpoints");
		});

		it("renders timestamps on each node", async () => {
			await view.onOpen();

			const times = view.contentEl.querySelectorAll(".ft-timeline-node-time");
			expect(times.length).toBe(4);
			// All thoughts share the same timestamp in our fixture
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

	describe("active node highlighting", () => {
		it("highlights active thought node", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t2" }, { history: false });

			const activeNodes = view.contentEl.querySelectorAll(".ft-timeline-node-active");
			expect(activeNodes.length).toBe(1);
		});

		it("shows filled bullet for active node", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t1" }, { history: false });

			const activeBullets = view.contentEl.querySelectorAll(".ft-timeline-bullet-active");
			expect(activeBullets.length).toBe(1);
			expect(activeBullets[0].textContent).toBe("●");
		});

		it("shows open bullet for inactive nodes", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t1" }, { history: false });

			const bullets = view.contentEl.querySelectorAll(".ft-timeline-bullet:not(.ft-timeline-bullet-active)");
			// 3 inactive nodes out of 4 total
			expect(bullets.length).toBe(3);
			for (const bullet of Array.from(bullets)) {
				expect(bullet.textContent).toBe("○");
			}
		});
	});

	describe("click navigation", () => {
		it("emits train.thought.activated on node click", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			// Click the second node (Schema design = t2)
			const nodes = view.contentEl.querySelectorAll(".ft-timeline-node");
			(nodes[1] as HTMLElement).click();

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
			(nodes[1] as HTMLElement).click();

			const activeNodes = view.contentEl.querySelectorAll(".ft-timeline-node-active");
			expect(activeNodes.length).toBe(1);
		});

		it("clicking branch node emits correct thoughtId", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			// Branch node is the 3rd node (index 2)
			const branchNode = view.contentEl.querySelector(".ft-timeline-node-branch") as HTMLElement;
			branchNode.click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.thoughtId).toBe("t3");
		});
	});

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

	// ── Inc 2: Tree structure & connectors ───────────────

	describe("tree structure", () => {
		it("renders ├─ for non-last branch siblings", async () => {
			// Two branches from t2: t3a (first), t3b (last)
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
			(service.getChildren as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => {
					if (thoughtId === "t1") return [t2];
					if (thoughtId === "t2") return [t3a, t3b];
					return [];
				},
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const connectors = treeView.contentEl.querySelectorAll(".ft-timeline-connector");
			expect(connectors.length).toBe(2);
			expect(connectors[0].textContent).toBe("├─"); // first sibling
			expect(connectors[1].textContent).toBe("└─"); // last sibling
		});

		it("renders branch count badge (+N)", async () => {
			await view.onOpen();

			// t2 has 1 branch (t3)
			const badges = view.contentEl.querySelectorAll(".ft-timeline-branch-badge");
			expect(badges.length).toBe(1);
			expect(badges[0].textContent).toBe("+1");
		});

		it("renders recursive branches at increasing depth", async () => {
			// t1 → t2 (main), t2 → t3 (branch), t3 → t4 (sub-branch)
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
			(service.getChildren as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => {
					if (thoughtId === "t1") return [t2];
					if (thoughtId === "t2") return [t3];
					if (thoughtId === "t3") return [t4];
					return [];
				},
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const branchNodes = treeView.contentEl.querySelectorAll(".ft-timeline-node-branch");
			expect(branchNodes.length).toBe(2);

			// First branch at depth 1 (16px), sub-branch at depth 2 (32px)
			expect((branchNodes[0] as HTMLElement).style.paddingLeft).toBe("16px");
			expect((branchNodes[1] as HTMLElement).style.paddingLeft).toBe("32px");
		});

		it("limits recursion depth to 5", async () => {
			// Create a chain: root → b1 → b2 → b3 → b4 → b5 → b6 (should be capped)
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
			(service.getChildren as ReturnType<typeof vi.fn>).mockImplementation(
				(_tid: string, thoughtId: string) => {
					const rel = rels.find((r) => r.fromId === thoughtId);
					if (!rel) return [];
					return [thoughts.find((t) => t.id === rel.toId)!];
				},
			);

			const treeView = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
			await treeView.onOpen();

			const branchNodes = treeView.contentEl.querySelectorAll(".ft-timeline-node-branch");
			// Root at depth 0, then b1-b5 at depths 1-5 = 5 branch nodes (b6 and b7 capped)
			expect(branchNodes.length).toBe(5);
		});

		it("does not render connector on main chain nodes", async () => {
			await view.onOpen();

			// Main chain nodes (depth 0) should have no connector
			const mainNodes = view.contentEl.querySelectorAll(".ft-timeline-node:not(.ft-timeline-node-branch)");
			for (const node of Array.from(mainNodes)) {
				const connector = node.querySelector(".ft-timeline-connector");
				expect(connector).toBeNull();
			}
		});

		it("auto-scrolls active node into view", async () => {
			// Spy on scrollIntoView
			const scrollSpy = vi.fn();
			HTMLElement.prototype.scrollIntoView = scrollSpy;

			await view.onOpen();
			await view.setState({ trainId: "train_1", activeThoughtId: "t4" }, { history: false });

			// Wait for setTimeout(0) used for auto-scroll
			await new Promise((r) => setTimeout(r, 10));

			expect(scrollSpy).toHaveBeenCalled();
		});
	});

	// ── Inc 5: Collapse/Expand & stat line ──────────────

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
			// 4 thoughts in the default mock train
			expect(statLine?.textContent).toContain("4 thoughts");
		});

		it("shows branch count in stat line", async () => {
			await view.onOpen();

			const statLine = view.contentEl.querySelector(".ft-timeline-stat-line");
			// t2 has 1 branch (t3)
			expect(statLine?.textContent).toContain("1 branches");
		});
	});
});
