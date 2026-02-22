// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainMainView } from "../../../src/ui/train/TrainMainView";
import { VIEW_TYPE_TRAIN_MAIN } from "../../../src/ui/train/types";
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
	const t1 = createThought({ id: "t1", title: "First Idea", order: 0 });
	const t2 = createThought({ id: "t2", title: "Second Idea", order: 1 });
	const t3 = createThought({ id: "t3", title: "Branch Idea", order: 2 });
	const defaultTrain = train ?? createTrain({
		thoughts: [t1, t2, t3],
		relations: [
			{ fromId: "t1", toId: "t2", direction: "next" },
			{ fromId: "t1", toId: "t3", direction: "branch" },
		],
	});

	return {
		getTrain: vi.fn((id: string) => id === defaultTrain.id ? defaultTrain : undefined),
		getActiveTrain: vi.fn(() => defaultTrain.status !== "completed" ? defaultTrain : undefined),
		getTimeline: vi.fn(() => [t1, t2]),
		getBranches: vi.fn((_trainId: string, thoughtId: string) =>
			thoughtId === "t1" ? [t3] : [],
		),
		getChildren: vi.fn(() => []),
		getAllTrains: vi.fn(() => [defaultTrain]),
		getMainChainIds: vi.fn(() => {
			const incomingNext = new Set(
				defaultTrain.relations.filter((r) => r.direction === "next").map((r) => r.toId),
			);
			const root = defaultTrain.thoughts.find((t) => !incomingNext.has(t.id));
			if (!root) return new Set<string>();
			const nextMap = new Map<string, string>();
			for (const r of defaultTrain.relations) {
				if (r.direction === "next") nextMap.set(r.fromId, r.toId);
			}
			const ids = new Set<string>([root.id]);
			let cur = root.id;
			while (nextMap.has(cur)) {
				cur = nextMap.get(cur)!;
				ids.add(cur);
			}
			return ids;
		}),
	} as unknown as TrainService;
}

// ── Tests ────────────────────────────────────────────────

describe("TrainMainView", () => {
	let eventBus: EventBus;
	let trainService: TrainService;
	let view: TrainMainView;

	beforeEach(() => {
		eventBus = new EventBus();
		trainService = createMockTrainService();
		view = new TrainMainView(createMockLeaf(), eventBus, trainService);
	});

	describe("view type", () => {
		it("returns correct view type", () => {
			expect(view.getViewType()).toBe(VIEW_TYPE_TRAIN_MAIN);
			expect(view.getViewType()).toBe("flowti-train-main");
		});

		it("returns train-front icon", () => {
			expect(view.getIcon()).toBe("train-front");
		});

		it("returns default display text when no train", () => {
			const emptyView = new TrainMainView(
				createMockLeaf(),
				eventBus,
				createMockTrainService(createTrain({ id: "other", status: "completed" })),
			);
			expect(emptyView.getDisplayText()).toBe("Train of Thoughts");
		});

		it("returns train title in display text", async () => {
			await view.onOpen();
			expect(view.getDisplayText()).toBe("Train: My Train");
		});
	});

	describe("state persistence", () => {
		it("getState returns trainId", async () => {
			await view.onOpen();
			expect(view.getState()).toEqual({ trainId: "train_1" });
		});

		it("getState returns null when no train", () => {
			expect(view.getState()).toEqual({ trainId: null });
		});

		it("setState sets trainId and re-renders", async () => {
			await view.onOpen();
			await view.setState({ trainId: "train_1" }, { history: false });
			expect(view.getState()).toEqual({ trainId: "train_1" });
		});
	});

	describe("rendering", () => {
		it("shows empty state when no active train", async () => {
			const noTrainService = createMockTrainService(
				createTrain({ id: "none", status: "completed" }),
			);
			(noTrainService.getActiveTrain as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
			(noTrainService.getTrain as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

			const emptyView = new TrainMainView(createMockLeaf(), eventBus, noTrainService);
			await emptyView.onOpen();

			const empty = emptyView.contentEl.querySelector(".ft-train-empty");
			expect(empty).not.toBeNull();
		});

		it("renders header with train title", async () => {
			await view.onOpen();

			const title = view.contentEl.querySelector(".ft-train-title");
			expect(title?.textContent).toBe("Train: My Train");
		});

		it("renders status badge", async () => {
			await view.onOpen();

			const badge = view.contentEl.querySelector(".ft-train-status");
			expect(badge?.textContent).toBe("running");
			expect(badge?.classList.contains("ft-train-status-running")).toBe(true);
		});

		it("renders thought counter", async () => {
			await view.onOpen();

			const counter = view.contentEl.querySelector(".ft-train-nav-counter");
			expect(counter?.textContent).toBe("Thought 1 of 3");
		});

		it("renders active thought title", async () => {
			await view.onOpen();

			const thoughtTitle = view.contentEl.querySelector(".ft-train-thought-title");
			expect(thoughtTitle?.textContent).toBe("First Idea");
		});

		it("renders thought metadata as info grid", async () => {
			await view.onOpen();

			const meta = view.contentEl.querySelector(".ft-train-thought-meta");
			expect(meta).not.toBeNull();
			expect(meta?.textContent).toContain("#1");
			expect(meta?.textContent).toContain("root");

			const labels = view.contentEl.querySelectorAll(".ft-detail-info-label");
			expect(labels.length).toBeGreaterThanOrEqual(3);
		});

		it("renders branch links for thoughts with branches", async () => {
			await view.onOpen();

			const branches = view.contentEl.querySelector(".ft-train-branches");
			expect(branches).not.toBeNull();

			const links = view.contentEl.querySelectorAll(".ft-train-branch-link");
			expect(links.length).toBe(1);
			expect(links[0].textContent).toContain("Branch Idea");
		});

		it("hides branch section when no branches", async () => {
			// Navigate to t2 which has no branches
			await view.onOpen();

			// Click next to go to second thought
			const nextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			nextBtn.click();

			const branches = view.contentEl.querySelector(".ft-train-branches");
			expect(branches).toBeNull();
		});
	});

	describe("navigation", () => {
		it("disables Prev button on first thought", async () => {
			await view.onOpen();

			const prevBtn = view.contentEl.querySelector(".ft-train-nav-btn") as HTMLButtonElement;
			expect(prevBtn.disabled).toBe(true);
			expect(prevBtn.classList.contains("ft-train-nav-disabled")).toBe(true);
		});

		it("enables Next button when not at end", async () => {
			await view.onOpen();

			const buttons = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			const nextBtn = buttons[1] as HTMLButtonElement;
			expect(nextBtn.disabled).toBe(false);
		});

		it("navigates to next thought on click", async () => {
			await view.onOpen();

			const buttons = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			const nextBtn = buttons[1] as HTMLButtonElement;
			nextBtn.click();

			const thoughtTitle = view.contentEl.querySelector(".ft-train-thought-title");
			expect(thoughtTitle?.textContent).toBe("Second Idea");

			const counter = view.contentEl.querySelector(".ft-train-nav-counter");
			expect(counter?.textContent).toBe("Thought 2 of 3");
		});

		it("navigates back to previous thought", async () => {
			await view.onOpen();

			// Go to second thought
			const nextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			nextBtn.click();

			// Go back
			const prevBtn = view.contentEl.querySelector(".ft-train-nav-btn") as HTMLButtonElement;
			prevBtn.click();

			const thoughtTitle = view.contentEl.querySelector(".ft-train-thought-title");
			expect(thoughtTitle?.textContent).toBe("First Idea");
		});

		it("disables Next button on last thought", async () => {
			await view.onOpen();

			// Go to last thought (3 total: t1, t2, t3 — need 2 clicks)
			let nextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			nextBtn.click();
			nextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			nextBtn.click();

			// Now next should be disabled
			const newNextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			expect(newNextBtn.disabled).toBe(true);
		});

		it("emits train.thought.activated on navigation", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			const nextBtn = view.contentEl.querySelectorAll(".ft-train-nav-btn")[1] as HTMLButtonElement;
			nextBtn.click();

			// Give the event a tick to fire
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({
				trainId: "train_1",
				thoughtId: "t2",
			});
		});
	});

	describe("controls panel integration", () => {
		it("renders controls section with buttons for running train", async () => {
			await view.onOpen();

			const controlsSection = view.contentEl.querySelector(".ft-train-controls-section");
			expect(controlsSection).not.toBeNull();

			const btns = view.contentEl.querySelectorAll(".ft-btn");
			expect(btns.length).toBeGreaterThan(0);
		});

		it("renders Add Thought button for running train", async () => {
			await view.onOpen();

			const btns = view.contentEl.querySelectorAll(".ft-btn");
			const addBtn = Array.from(btns).find((b) => b.textContent?.includes("Add Thought"));
			expect(addBtn).not.toBeUndefined();
		});

		it("hides controls for completed train", async () => {
			const completedTrain = createTrain({ status: "completed" });
			const service = createMockTrainService(completedTrain);
			const completedView = new TrainMainView(createMockLeaf(), eventBus, service);
			await completedView.onOpen();

			const btns = completedView.contentEl.querySelectorAll(".ft-btn");
			expect(btns.length).toBe(0);
		});

		it("renders stats section with shared stat grid", async () => {
			await view.onOpen();

			const statsSection = view.contentEl.querySelector(".ft-train-stats-section");
			expect(statsSection).not.toBeNull();

			const statCards = view.contentEl.querySelectorAll(".ft-stat-card");
			expect(statCards.length).toBe(4);
		});
	});

	describe("event subscriptions", () => {
		it("re-renders on train.thought.added", async () => {
			await view.onOpen();

			await eventBus.emit("train.thought.added", {
				trainId: "train_1",
				thought: createThought({ id: "t4", title: "New Thought", order: 3 }),
				previousTitle: "Second Idea",
				direction: "next" as const,
			});

			// Wait for debounced render
			await new Promise((r) => setTimeout(r, 30));

			// View should have re-rendered (getTrain called again)
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

			await eventBus.emit("train.completed", { trainId: "train_1", thoughtCount: 3 });
			await new Promise((r) => setTimeout(r, 30));

			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
		});

		it("ignores events for different trains", async () => {
			await view.onOpen();
			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

			await eventBus.emit("train.paused", { trainId: "other_train" });
			await new Promise((r) => setTimeout(r, 30));

			// Should NOT have re-rendered
			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
		});

		it("cleans up subscriptions on close", async () => {
			await view.onOpen();

			await view.onClose();

			const callCount = (trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;
			await eventBus.emit("train.paused", { trainId: "train_1" });
			await new Promise((r) => setTimeout(r, 30));

			// Should NOT have re-rendered after close
			expect((trainService.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
		});
	});

	describe("branch link navigation", () => {
		it("emits train.thought.activated when branch link clicked", async () => {
			const handler = vi.fn();
			eventBus.on("train.thought.activated", handler);

			await view.onOpen();

			const branchLink = view.contentEl.querySelector(".ft-train-branch-link") as HTMLElement;
			branchLink.click();

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.thoughtId).toBe("t3");
		});
	});
});
