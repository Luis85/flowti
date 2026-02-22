// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainMainView } from "../../../src/ui/train/TrainMainView";
import type { TrainViewSettings } from "../../../src/ui/train/TrainMainView";
import { TrainTimelineSidebar } from "../../../src/ui/train/TrainTimelineSidebar";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";
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

function createMockTrainService(train: TrainState): TrainService {
	const t1 = train.thoughts[0] ?? createThought({ id: "t1", title: "First", order: 0 });
	return {
		getTrain: vi.fn((id: string) => id === train.id ? train : undefined),
		getActiveTrain: vi.fn(() => train.status !== "completed" ? train : undefined),
		getTimeline: vi.fn(() => train.thoughts.filter((t) =>
			!train.relations.some((r) => r.toId === t.id && r.direction === "branch"),
		)),
		getBranches: vi.fn((_trainId: string, thoughtId: string) =>
			train.relations
				.filter((r) => r.fromId === thoughtId && r.direction === "branch")
				.map((r) => train.thoughts.find((t) => t.id === r.toId))
				.filter(Boolean) as ThoughtNode[],
		),
		getChildren: vi.fn(() => []),
		getMerges: vi.fn(() => train.relations.filter((r) => r.direction === "merge")),
		mergeBranch: vi.fn(async () => true),
		undoMerge: vi.fn(async () => true),
		getAllTrains: vi.fn(() => [train]),
		findMergeDownTarget: vi.fn(() => null),
		getMainChainIds: vi.fn(() => {
			const incomingNext = new Set(
				train.relations.filter((r) => r.direction === "next").map((r) => r.toId),
			);
			const root = train.thoughts.find((t) => !incomingNext.has(t.id));
			if (!root) return new Set<string>();
			const nextMap = new Map<string, string>();
			for (const r of train.relations) {
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

const defaultSettings: TrainViewSettings = {
	trainFolder: "trains",
	trainCanvasEnabled: true,
	trainCanvasAutoOpen: false,
};

// ── TrainMainView — Open Canvas button ──────────────────

describe("TrainMainView — canvas workflow", () => {
	let eventBus: EventBus;
	let train: TrainState;
	let service: TrainService;

	beforeEach(() => {
		eventBus = new EventBus();
		const t1 = createThought({ id: "t1", title: "First Idea", order: 0 });
		train = createTrain({ thoughts: [t1] });
		service = createMockTrainService(train);
	});

	it("does not show canvas button when no vault (test environment)", async () => {
		const view = new TrainMainView(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);
		await view.onOpen();

		// No app.vault in test, so canvas existence check is falsy
		const canvasBtn = view.contentEl.querySelector(".ft-train-open-canvas-btn");
		expect(canvasBtn).toBeNull();
	});

	it("does not show canvas button when trainCanvasEnabled is false", async () => {
		const view = new TrainMainView(
			createMockLeaf(), eventBus, service,
			() => ({ ...defaultSettings, trainCanvasEnabled: false }),
		);
		await view.onOpen();

		const canvasBtn = view.contentEl.querySelector(".ft-train-open-canvas-btn");
		expect(canvasBtn).toBeNull();
	});

	it("shows canvas callout with open button when canvas file exists", async () => {
		const view = new TrainMainView(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);

		// Mock registerEvent (Component method) + vault
		(view as unknown as Record<string, unknown>).registerEvent = vi.fn();
		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) =>
					path === "trains/My Train.canvas" ? { path } : null,
				),
				on: vi.fn(() => ({ unload: vi.fn() })),
			},
			workspace: {
				openLinkText: vi.fn(),
			},
		};

		await view.onOpen();

		const callout = view.contentEl.querySelector(".ft-train-canvas-callout");
		expect(callout).not.toBeNull();
		const openBtn = callout?.querySelector("button");
		expect(openBtn?.textContent).toContain("Open");
	});

	it("opens canvas when callout open button clicked", async () => {
		const mockOpenLinkText = vi.fn();
		const view = new TrainMainView(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);

		(view as unknown as Record<string, unknown>).registerEvent = vi.fn();
		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) =>
					path === "trains/My Train.canvas" ? { path } : null,
				),
				on: vi.fn(() => ({ unload: vi.fn() })),
			},
			workspace: {
				openLinkText: mockOpenLinkText,
			},
		};

		await view.onOpen();

		const callout = view.contentEl.querySelector(".ft-train-canvas-callout");
		const openBtn = callout?.querySelector("button") as HTMLButtonElement;
		openBtn.click();

		expect(mockOpenLinkText).toHaveBeenCalledWith("trains/My Train.canvas", "", false);
	});

	it("derives canvas path from trainFolder + train title", async () => {
		const view = new TrainMainView(
			createMockLeaf(), eventBus, service,
			() => ({ ...defaultSettings, trainFolder: "00 - Connectivity/trains" }),
		);

		const mockGetAbstract = vi.fn((path: string) =>
			path === "00 - Connectivity/trains/My Train.canvas" ? { path } : null,
		);

		(view as unknown as Record<string, unknown>).registerEvent = vi.fn();
		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: mockGetAbstract,
				on: vi.fn(() => ({ unload: vi.fn() })),
			},
			workspace: { openLinkText: vi.fn() },
		};

		await view.onOpen();

		expect(mockGetAbstract).toHaveBeenCalledWith("00 - Connectivity/trains/My Train.canvas");
	});
});

// ── TrainTimelineSidebar — Open Canvas button ───────────

describe("TrainTimelineSidebar — canvas workflow", () => {
	let eventBus: EventBus;
	let train: TrainState;
	let service: TrainService;

	beforeEach(() => {
		eventBus = new EventBus();
		const t1 = createThought({ id: "t1", title: "First", order: 0 });
		train = createTrain({ thoughts: [t1] });
		service = createMockTrainService(train);
	});

	it("does not show canvas button without vault", async () => {
		const view = new TrainTimelineSidebar(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);
		await view.onOpen();

		const canvasBtn = view.contentEl.querySelector(".ft-timeline-open-canvas-btn");
		expect(canvasBtn).toBeNull();
	});

	it("shows canvas button when canvas file exists", async () => {
		const view = new TrainTimelineSidebar(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);

		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) =>
					path === "trains/My Train.canvas" ? { path } : null,
				),
			},
			workspace: { openLinkText: vi.fn() },
		};

		await view.onOpen();

		const canvasBtn = view.contentEl.querySelector(".ft-timeline-open-canvas-btn");
		expect(canvasBtn).not.toBeNull();
	});

	it("opens canvas when button clicked", async () => {
		const mockOpenLinkText = vi.fn();
		const view = new TrainTimelineSidebar(
			createMockLeaf(), eventBus, service,
			() => defaultSettings,
		);

		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) =>
					path === "trains/My Train.canvas" ? { path } : null,
				),
			},
			workspace: { openLinkText: mockOpenLinkText },
		};

		await view.onOpen();

		const canvasBtn = view.contentEl.querySelector(".ft-timeline-open-canvas-btn") as HTMLButtonElement;
		canvasBtn.click();

		expect(mockOpenLinkText).toHaveBeenCalledWith("trains/My Train.canvas", "", false);
	});

	it("hides canvas button when trainCanvasEnabled is false", async () => {
		const view = new TrainTimelineSidebar(
			createMockLeaf(), eventBus, service,
			() => ({ ...defaultSettings, trainCanvasEnabled: false }),
		);

		(view as unknown as { app: unknown }).app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => ({ path: "whatever" })),
			},
			workspace: { openLinkText: vi.fn() },
		};

		await view.onOpen();

		const canvasBtn = view.contentEl.querySelector(".ft-timeline-open-canvas-btn");
		expect(canvasBtn).toBeNull();
	});
});

// ── Auto-open canvas ────────────────────────────────────

describe("Canvas auto-open on train.canvas.created", () => {
	it("opens canvas when trainCanvasAutoOpen is true", async () => {
		const eventBus = new EventBus();
		const mockOpenLinkText = vi.fn();

		// Simulate the main.ts wiring — listen for canvas.created
		const getSettings = () => ({
			trainCanvasAutoOpen: true,
		});

		eventBus.on("train.canvas.created", (event) => {
			if (getSettings().trainCanvasAutoOpen) {
				mockOpenLinkText(event.payload.canvasPath);
			}
		});

		await eventBus.emit("train.canvas.created", {
			trainId: "train_1",
			canvasPath: "trains/My Train.canvas",
		});

		expect(mockOpenLinkText).toHaveBeenCalledWith("trains/My Train.canvas");
	});

	it("does not open canvas when trainCanvasAutoOpen is false", async () => {
		const eventBus = new EventBus();
		const mockOpenLinkText = vi.fn();

		const getSettings = () => ({
			trainCanvasAutoOpen: false,
		});

		eventBus.on("train.canvas.created", (event) => {
			if (getSettings().trainCanvasAutoOpen) {
				mockOpenLinkText(event.payload.canvasPath);
			}
		});

		await eventBus.emit("train.canvas.created", {
			trainId: "train_1",
			canvasPath: "trains/My Train.canvas",
		});

		expect(mockOpenLinkText).not.toHaveBeenCalled();
	});
});
