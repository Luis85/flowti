// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainMainView } from "../../../src/ui/train/TrainMainView";
import { TrainTimelineSidebar } from "../../../src/ui/train/TrainTimelineSidebar";
import { TrainMergeSelector } from "../../../src/ui/train/TrainMergeSelector";
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
		path: "trains/Test Thought.md",
		createdAt: "2026-02-22T14:30:00.000Z",
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
		createdAt: "2026-02-22T14:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		...overrides,
	};
}

/**
 * Build a train with branch + merge:
 * A → B → C (main chain), A → D (branch), D merged → B
 */
function buildMergedTrain(): {
	train: TrainState;
	thoughts: { a: ThoughtNode; b: ThoughtNode; c: ThoughtNode; d: ThoughtNode };
} {
	const a = createThought({ id: "a", title: "Root", order: 0 });
	const b = createThought({ id: "b", title: "Second", order: 1 });
	const c = createThought({ id: "c", title: "Third", order: 2 });
	const d = createThought({ id: "d", title: "Branch Alt", order: 3 });

	const train = createTrain({
		thoughts: [a, b, c, d],
		relations: [
			{ fromId: "a", toId: "b", direction: "next" },
			{ fromId: "b", toId: "c", direction: "next" },
			{ fromId: "a", toId: "d", direction: "branch" },
			{ fromId: "d", toId: "b", direction: "merge" },
		],
	});

	return { train, thoughts: { a, b, c, d } };
}

/**
 * Build a train with an unmerged branch endpoint:
 * A → B (main chain), A → D (branch, endpoint)
 */
function buildUnmergedTrain(): {
	train: TrainState;
	thoughts: { a: ThoughtNode; b: ThoughtNode; d: ThoughtNode };
} {
	const a = createThought({ id: "a", title: "Root", order: 0 });
	const b = createThought({ id: "b", title: "Second", order: 1 });
	const d = createThought({ id: "d", title: "Branch Endpoint", order: 2 });

	const train = createTrain({
		thoughts: [a, b, d],
		relations: [
			{ fromId: "a", toId: "b", direction: "next" },
			{ fromId: "a", toId: "d", direction: "branch" },
		],
	});

	return { train, thoughts: { a, b, d } };
}

function createMergedTrainService(trainData: TrainState): TrainService {
	return {
		getTrain: vi.fn((id: string) => id === trainData.id ? trainData : undefined),
		getActiveTrain: vi.fn(() => trainData.status !== "completed" ? trainData : undefined),
		getTimeline: vi.fn(() => {
			// Main chain: follow "next" from root
			const root = trainData.thoughts.find(
				(t) => !trainData.relations.some((r) => r.toId === t.id && r.direction === "next"),
			);
			if (!root) return [];
			const chain: ThoughtNode[] = [root];
			let current = root;
			while (true) {
				const nextRel = trainData.relations.find(
					(r) => r.fromId === current.id && r.direction === "next",
				);
				if (!nextRel) break;
				const next = trainData.thoughts.find((t) => t.id === nextRel.toId);
				if (!next) break;
				chain.push(next);
				current = next;
			}
			return chain;
		}),
		getBranches: vi.fn((_trainId: string, thoughtId: string) =>
			trainData.relations
				.filter((r) => r.fromId === thoughtId && r.direction === "branch")
				.map((r) => trainData.thoughts.find((t) => t.id === r.toId))
				.filter(Boolean) as ThoughtNode[],
		),
		getChildren: vi.fn((_trainId: string, thoughtId: string) =>
			trainData.relations
				.filter((r) => r.fromId === thoughtId)
				.map((r) => trainData.thoughts.find((t) => t.id === r.toId))
				.filter(Boolean) as ThoughtNode[],
		),
		getMerges: vi.fn(() =>
			trainData.relations.filter((r) => r.direction === "merge"),
		),
		mergeBranch: vi.fn(async () => true),
		undoMerge: vi.fn(async () => true),
		getAllTrains: vi.fn(() => [trainData]),
		getMainChainIds: vi.fn(() => {
			// Walk "next" from root to compute main chain IDs
			const incomingNext = new Set(
				trainData.relations.filter((r) => r.direction === "next").map((r) => r.toId),
			);
			const root = trainData.thoughts.find((t) => !incomingNext.has(t.id));
			if (!root) return new Set<string>();
			const nextMap = new Map<string, string>();
			for (const r of trainData.relations) {
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

// ── TrainTimelineSidebar merge indicators ───────────────

describe("TrainTimelineSidebar — merge indicators", () => {
	it("shows merge badge on source thought with outgoing merge", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const mergeBadges = view.contentEl.querySelectorAll(".ft-timeline-merge-badge");
		expect(mergeBadges.length).toBe(1);
		expect(mergeBadges[0].textContent).toBe("⤴ merged");
	});

	it("shows merge target badge on thought with incoming merge", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const targetBadges = view.contentEl.querySelectorAll(".ft-timeline-merge-target-badge");
		expect(targetBadges.length).toBe(1);
		expect(targetBadges[0].textContent).toBe("⤵ target");
	});

	it("shows no merge badges when train has no merges", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
		await view.onOpen();

		expect(view.contentEl.querySelectorAll(".ft-timeline-merge-badge").length).toBe(0);
		expect(view.contentEl.querySelectorAll(".ft-timeline-merge-target-badge").length).toBe(0);
	});

	it("re-renders on train.branch.merged event", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const callCount = (service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

		await eventBus.emit("train.branch.merged", {
			trainId: "train_1",
			sourceId: "d",
			targetId: "b",
		});
		await new Promise((r) => setTimeout(r, 30));

		expect((service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
	});

	it("re-renders on train.branch.merge.undone event", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainTimelineSidebar(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const callCount = (service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

		await eventBus.emit("train.branch.merge.undone", {
			trainId: "train_1",
			sourceId: "d",
			targetId: "b",
		});
		await new Promise((r) => setTimeout(r, 30));

		expect((service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
	});
});

// ── TrainMainView merge section ─────────────────────────

describe("TrainMainView — merge section", () => {
	it("shows 'Merge into...' button on branch endpoint thought", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to branch endpoint (d) — re-query buttons after each click since render() rebuilds DOM
		await view.setState({ trainId: "train_1" }, { history: false });
		for (let i = 0; i < 2; i++) {
			const btns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			(btns[1] as HTMLButtonElement).click();
		}

		const mergeBtn = view.contentEl.querySelector(".ft-train-merge-btn");
		expect(mergeBtn).not.toBeNull();
		expect(mergeBtn?.textContent).toContain("Merge into...");
	});

	it("does not show 'Merge into...' on root thought", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// First thought (root) should be active by default
		const mergeBtn = view.contentEl.querySelector(".ft-train-merge-btn");
		expect(mergeBtn).toBeNull();
	});

	it("does not show 'Merge into...' on main chain endpoint (head)", async () => {
		// b is the head of the main chain — protected, no merge button
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to b (second thought on main chain)
		const navBtns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
		(navBtns[1] as HTMLButtonElement).click(); // a → b

		// b is on the main chain → merge button hidden (main chain protection)
		const mergeBtn = view.contentEl.querySelector(".ft-train-merge-btn");
		expect(mergeBtn).toBeNull();
	});

	it("shows existing merges with undo button", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to d (index 3 in order-sorted list) — re-query buttons after each click
		for (let i = 0; i < 3; i++) {
			const btns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			(btns[1] as HTMLButtonElement).click();
		}

		const mergeLinks = view.contentEl.querySelectorAll(".ft-train-merge-link");
		expect(mergeLinks.length).toBe(1);
		expect(mergeLinks[0].textContent).toContain("Second"); // target title

		const undoBtn = view.contentEl.querySelector(".ft-train-merge-undo");
		expect(undoBtn).not.toBeNull();
	});

	it("calls trainService.undoMerge when undo clicked", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to d — re-query buttons after each click
		for (let i = 0; i < 3; i++) {
			const btns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			(btns[1] as HTMLButtonElement).click();
		}

		const undoBtn = view.contentEl.querySelector(".ft-train-merge-undo") as HTMLButtonElement;
		undoBtn.click();

		expect(service.undoMerge).toHaveBeenCalledWith("train_1", "d", "b");
	});

	it("hides merge section on completed trains", async () => {
		const { train } = buildMergedTrain();
		train.status = "completed";
		const service = createMergedTrainService(train);
		(service.getActiveTrain as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

		const eventBus = new EventBus();
		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.setState({ trainId: "train_1" }, { history: false });
		await view.onOpen();

		const mergeSection = view.contentEl.querySelector(".ft-train-merge-section");
		expect(mergeSection).toBeNull();
	});

	it("re-renders on train.branch.merged event", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const callCount = (service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

		await eventBus.emit("train.branch.merged", {
			trainId: "train_1",
			sourceId: "d",
			targetId: "b",
		});
		await new Promise((r) => setTimeout(r, 30));

		expect((service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
	});

	it("re-renders on train.branch.merge.undone event", async () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		const callCount = (service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length;

		await eventBus.emit("train.branch.merge.undone", {
			trainId: "train_1",
			sourceId: "d",
			targetId: "b",
		});
		await new Promise((r) => setTimeout(r, 30));

		expect((service.getTrain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
	});
});

// ── TrainMergeSelector ──────────────────────────────────

describe("TrainMergeSelector", () => {
	it("renders all thoughts as targets", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const onSelect = vi.fn();
		const onCancel = vi.fn();
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect, onCancel });
		selector.render(train, "d"); // source = d

		const targets = el.querySelectorAll(".ft-merge-target");
		expect(targets.length).toBe(3); // a, b, d
	});

	it("marks source thought as disabled with (source) label", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel: vi.fn() });
		selector.render(train, "d");

		const targets = el.querySelectorAll(".ft-merge-target");
		const sourceTarget = Array.from(targets).find((t) => t.textContent?.includes("Branch Endpoint"));
		expect(sourceTarget?.classList.contains("ft-merge-target-disabled")).toBe(true);
		expect(sourceTarget?.textContent).toContain("(source)");
	});

	it("marks descendants as disabled with (descendant) label", () => {
		// Build train: A → B → C, source = A (B and C are descendants)
		const a = createThought({ id: "a", title: "Root", order: 0 });
		const b = createThought({ id: "b", title: "Child", order: 1 });
		const c = createThought({ id: "c", title: "Grandchild", order: 2 });
		const train = createTrain({
			thoughts: [a, b, c],
			relations: [
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
			],
		});
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel: vi.fn() });
		selector.render(train, "a"); // source = a

		const targets = el.querySelectorAll(".ft-merge-target-disabled");
		expect(targets.length).toBe(3); // a (self), b (descendant), c (descendant)

		const descendantLabels = Array.from(el.querySelectorAll(".ft-merge-target")).filter(
			(t) => t.textContent?.includes("(descendant)"),
		);
		expect(descendantLabels.length).toBe(2);
	});

	it("marks already-merged targets as disabled", () => {
		const { train } = buildMergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel: vi.fn() });
		selector.render(train, "d"); // d already merged → b

		const targets = el.querySelectorAll(".ft-merge-target");
		const mergedTarget = Array.from(targets).find((t) => t.textContent?.includes("Second"));
		expect(mergedTarget?.classList.contains("ft-merge-target-disabled")).toBe(true);
		expect(mergedTarget?.textContent).toContain("(already merged)");
	});

	it("marks valid targets as clickable", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel: vi.fn() });
		selector.render(train, "d"); // source = d, no descendants

		const validTargets = el.querySelectorAll(".ft-merge-target-valid");
		// d has no descendants via next/branch, so a and b are valid
		expect(validTargets.length).toBe(2); // a and b
	});

	it("calls onSelect when valid target clicked", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const onSelect = vi.fn();
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect, onCancel: vi.fn() });
		selector.render(train, "d");

		const validTargets = el.querySelectorAll(".ft-merge-target-valid");
		(validTargets[0] as HTMLElement).click();

		expect(onSelect).toHaveBeenCalledOnce();
	});

	it("does not call onSelect when disabled target clicked", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const onSelect = vi.fn();
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect, onCancel: vi.fn() });
		selector.render(train, "d");

		const disabledTargets = el.querySelectorAll(".ft-merge-target-disabled");
		(disabledTargets[0] as HTMLElement).click();

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("calls onCancel when cancel button clicked", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const onCancel = vi.fn();
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel });
		selector.render(train, "d");

		const cancelBtn = el.querySelector("button") as HTMLButtonElement;
		cancelBtn.click();

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("renders header with 'Select merge target'", () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const el = document.createElement("div");
		const selector = new TrainMergeSelector(el, { trainService: service, onSelect: vi.fn(), onCancel: vi.fn() });
		selector.render(train, "d");

		const header = el.querySelector(".ft-merge-selector-header");
		expect(header?.textContent).toContain("Select merge target");
	});
});

// ── Main Chain Merge Protection in UI (Cycle 19 Inc 2) ───

describe("TrainMainView — main chain merge protection", () => {
	it("hides merge button when navigating to a main chain node", async () => {
		// Build: A→B→C (main chain), A→D (branch)
		const a = createThought({ id: "a", title: "Root", order: 0 });
		const b = createThought({ id: "b", title: "Middle", order: 1 });
		const c = createThought({ id: "c", title: "Head", order: 2 });
		const d = createThought({ id: "d", title: "Branch", order: 3 });

		const train = createTrain({
			thoughts: [a, b, c, d],
			relations: [
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
			],
		});

		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to C (head of main chain) — re-query buttons after each click since render() rebuilds DOM
		for (let i = 0; i < 2; i++) {
			const btns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			(btns[1] as HTMLButtonElement).click();
		}

		// C is on main chain (head) — no merge button
		const mergeBtn = view.contentEl.querySelector(".ft-train-merge-btn");
		expect(mergeBtn).toBeNull();
	});

	it("shows merge button on branch endpoint thought", async () => {
		const { train } = buildUnmergedTrain();
		const service = createMergedTrainService(train);
		const eventBus = new EventBus();

		const view = new TrainMainView(createMockLeaf(), eventBus, service);
		await view.onOpen();

		// Navigate to branch endpoint d — re-query buttons after each click since render() rebuilds DOM
		for (let i = 0; i < 2; i++) {
			const btns = view.contentEl.querySelectorAll(".ft-train-nav-btn");
			(btns[1] as HTMLButtonElement).click();
		}

		const mergeBtn = view.contentEl.querySelector(".ft-train-merge-btn");
		expect(mergeBtn).not.toBeNull();
	});

	it("getMainChainIds mock returns correct IDs for buildUnmergedTrain", () => {
		const { train, thoughts } = buildUnmergedTrain();
		const service = createMergedTrainService(train);

		const mainIds = service.getMainChainIds(train.id);
		expect(mainIds.has(thoughts.a.id)).toBe(true);
		expect(mainIds.has(thoughts.b.id)).toBe(true);
		expect(mainIds.has(thoughts.d.id)).toBe(false); // branch child
	});

	it("getMainChainIds mock returns correct IDs for buildMergedTrain", () => {
		const { train, thoughts } = buildMergedTrain();
		const service = createMergedTrainService(train);

		const mainIds = service.getMainChainIds(train.id);
		expect(mainIds.has(thoughts.a.id)).toBe(true);
		expect(mainIds.has(thoughts.b.id)).toBe(true);
		expect(mainIds.has(thoughts.c.id)).toBe(true);
		expect(mainIds.has(thoughts.d.id)).toBe(false); // branch child
	});
});
