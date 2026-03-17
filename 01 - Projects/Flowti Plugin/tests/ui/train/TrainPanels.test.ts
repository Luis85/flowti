// @vitest-environment happy-dom
/**
 * Inc 3: TrainStatsPanel and TrainControlsPanel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainStatsPanel } from "../../../src/ui/train/TrainStatsPanel";
import { TrainControlsPanel } from "../../../src/ui/train/TrainControlsPanel";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";
import type { TrainService } from "../../../src/domain/train/TrainService";
import type { TrainPanelDeps } from "../../../src/ui/train/types";

// ── Helpers ──────────────────────────────────────────────

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
		folderPath: "trains",
		...overrides,
	};
}

function createMockTrainService(): TrainService {
	return {
		getTrain: vi.fn(),
		getActiveTrain: vi.fn(),
		getTimeline: vi.fn(() => []),
		getBranches: vi.fn(() => []),
		getChildren: vi.fn(() => []),
		getAllTrains: vi.fn(() => []),
		pause: vi.fn(async () => true),
		resume: vi.fn(async () => true),
		completeTrain: vi.fn(async () => true),
	} as unknown as TrainService;
}

function createDeps(trainService?: TrainService): { deps: TrainPanelDeps; eventBus: EventBus } {
	const eventBus = new EventBus();
	const service = trainService ?? createMockTrainService();
	return {
		deps: {
			trainService: service,
			eventBus,
			scheduleRender: vi.fn(),
		},
		eventBus,
	};
}

// ── TrainStatsPanel ─────────────────────────────────────

describe("TrainStatsPanel", () => {
	let el: HTMLDivElement;

	beforeEach(() => {
		el = document.createElement("div");
	});

	it("renders shared stat grid", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1" });
		const t2 = createThought({ id: "t2" });
		const train = createTrain({ thoughts: [t1, t2] });
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const grid = el.querySelector(".ft-stat-grid");
		expect(grid).not.toBeNull();
	});

	it("shows correct thought count", () => {
		const { deps } = createDeps();
		const thoughts = [createThought({ id: "t1" }), createThought({ id: "t2" }), createThought({ id: "t3" })];
		const train = createTrain({ thoughts });
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue(thoughts);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const values = el.querySelectorAll(".ft-catalog-stat-value");
		expect(values[0].textContent).toBe("3"); // Thoughts
	});

	it("shows branch count", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1" });
		const t2 = createThought({ id: "t2" });
		const b1 = createThought({ id: "b1" });
		const train = createTrain({ thoughts: [t1, t2, b1] });
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockImplementation(
			(_tid: string, thoughtId: string) => thoughtId === "t1" ? [b1] : [],
		);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const values = el.querySelectorAll(".ft-catalog-stat-value");
		expect(values[1].textContent).toBe("1"); // Branches
	});

	it("shows chain length", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1" });
		const t2 = createThought({ id: "t2" });
		const b1 = createThought({ id: "b1" });
		const train = createTrain({ thoughts: [t1, t2, b1] });
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([t1, t2]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const values = el.querySelectorAll(".ft-catalog-stat-value");
		expect(values[2].textContent).toBe("2"); // Chain length (main timeline)
	});

	it("renders 4 stat cards", () => {
		const { deps } = createDeps();
		const train = createTrain();
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const cards = el.querySelectorAll(".ft-stat-card");
		expect(cards.length).toBe(4);
	});

	it("shows elapsed time for completed train", () => {
		const { deps } = createDeps();
		const train = createTrain({
			createdAt: "2026-02-21T14:00:00.000Z",
			completedAt: "2026-02-21T14:05:30.000Z",
		});
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);

		const values = el.querySelectorAll(".ft-catalog-stat-value");
		expect(values[3].textContent).toBe("5:30"); // 5 minutes 30 seconds
	});

	it("empties el on re-render", () => {
		const { deps } = createDeps();
		const train = createTrain();
		(deps.trainService.getTimeline as ReturnType<typeof vi.fn>).mockReturnValue([]);
		(deps.trainService.getBranches as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const panel = new TrainStatsPanel(el, deps);
		panel.render(train);
		panel.render(train);

		const grids = el.querySelectorAll(".ft-stat-grid");
		expect(grids.length).toBe(1); // Not duplicated
	});
});

// ── TrainControlsPanel ──────────────────────────────────

describe("TrainControlsPanel", () => {
	let el: HTMLDivElement;

	beforeEach(() => {
		el = document.createElement("div");
	});

	it("shows Pause and Complete buttons for running train", () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const buttons = el.querySelectorAll(".ft-btn");
		const labels = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(labels).toContain("Pause");
		expect(labels).toContain("Complete");
		expect(labels).toContain("Add Thought");
	});

	it("shows Resume and Complete buttons for paused train", () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "paused" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const buttons = el.querySelectorAll(".ft-btn");
		const labels = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(labels).toContain("Resume");
		expect(labels).toContain("Complete");
	});

	it("shows no buttons for completed train", () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "completed" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const buttons = el.querySelectorAll(".ft-btn");
		expect(buttons.length).toBe(0);
	});

	it("calls trainService.pause on Pause click", async () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const pauseBtn = Array.from(el.querySelectorAll(".ft-btn"))
			.find((b) => b.textContent?.includes("Pause")) as HTMLButtonElement;
		pauseBtn.click();

		await new Promise((r) => setTimeout(r, 0));

		expect(deps.trainService.pause).toHaveBeenCalledWith("train_1");
		expect(deps.scheduleRender).toHaveBeenCalled();
	});

	it("emits ui.startTrain with fromThoughtId on Resume click", async () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "paused" });

		const emitted: unknown[] = [];
		deps.eventBus.on("ui.startTrain", (event) => { emitted.push(event.payload); });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const resumeBtn = Array.from(el.querySelectorAll(".ft-btn"))
			.find((b) => b.textContent?.includes("Resume")) as HTMLButtonElement;
		resumeBtn.click();

		await new Promise((r) => setTimeout(r, 0));

		expect(emitted.length).toBe(1);
	});

	it("calls trainService.completeTrain on Complete click", async () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const completeBtn = Array.from(el.querySelectorAll(".ft-btn"))
			.find((b) => b.textContent?.includes("Complete")) as HTMLButtonElement;
		completeBtn.click();

		await new Promise((r) => setTimeout(r, 0));

		expect(deps.trainService.completeTrain).toHaveBeenCalledWith("train_1");
		expect(deps.scheduleRender).toHaveBeenCalled();
	});

	it("emits ui.startTrain on Add Thought click", async () => {
		const { deps, eventBus } = createDeps();
		const handler = vi.fn();
		eventBus.on("ui.startTrain", handler);

		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const addBtn = Array.from(el.querySelectorAll(".ft-btn"))
			.find((b) => b.textContent?.includes("Add Thought")) as HTMLButtonElement;
		addBtn.click();

		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
	});

	it("marks Add Thought as primary button", () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);

		const primaryBtns = el.querySelectorAll(".ft-btn-primary");
		expect(primaryBtns.length).toBe(1);
		expect(primaryBtns[0].textContent).toContain("Add Thought");
	});

	it("empties el on re-render", () => {
		const { deps } = createDeps();
		const train = createTrain({ status: "running" });

		const panel = new TrainControlsPanel(el, deps);
		panel.render(train);
		panel.render(train);

		const bars = el.querySelectorAll(".ft-detail-actions");
		expect(bars.length).toBe(1);
	});
});
