// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTrainTimelineHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/train-timeline-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import type { TrainState, ThoughtNode } from "../../../../src/domain/train/types";

// Import component to register custom element
import "../../../../src/components/train/flowti-train-timeline";

function makeThought(overrides: Partial<ThoughtNode> = {}): ThoughtNode {
	return {
		id: "t1",
		trainId: "train1",
		title: "First thought",
		path: "trains/t1.md",
		createdAt: new Date("2026-03-16T10:00:00Z").toISOString(),
		order: 0,
		...overrides,
	};
}

function makeTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train1",
		sessionId: "sess1",
		title: "Test Train",
		status: "running",
		thoughts: [makeThought()],
		relations: [],
		durationMinutes: 15,
		createdAt: new Date("2026-03-16T10:00:00Z").toISOString(),
		pausedAt: null,
		completedAt: null,
		folderPath: "trains/test-train",
		...overrides,
	};
}

function createMockTrainService(activeTrain: TrainState | undefined = undefined) {
	return {
		getActiveTrain: vi.fn(() => activeTrain),
		getTrain: vi.fn((id: string) => (activeTrain?.id === id ? activeTrain : undefined)),
		getTimeline: vi.fn((_id: string) => activeTrain?.thoughts ?? []),
		getBranches: vi.fn((_trainId: string, _thoughtId: string): ThoughtNode[] => []),
		setBranchStatus: vi.fn().mockResolvedValue(true),
		clearBranchStatus: vi.fn().mockResolvedValue(true),
	};
}

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

function createMockApp(canvasExists = false) {
	return {
		vault: {
			getAbstractFileByPath: vi.fn((path: string) => canvasExists ? { path } : null),
		},
	};
}

function createMockSettings(enabled = true) {
	return vi.fn(() => ({
		trainFolder: "trains",
		trainCanvasEnabled: enabled,
		trainCanvasAutoOpen: false,
	}));
}

describe("registerTrainTimelineHandler", () => {
	let registry: PluginHandlerRegistry;
	let trainService: ReturnType<typeof createMockTrainService>;
	let eventBus: IEventBus;
	let app: ReturnType<typeof createMockApp>;
	let getTrainSettings: ReturnType<typeof createMockSettings>;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		trainService = createMockTrainService();
		eventBus = createMockEventBus();
		app = createMockApp();
		getTrainSettings = createMockSettings();
	});

	function register(overrides: { activeTrain?: TrainState; canvasExists?: boolean; canvasEnabled?: boolean } = {}) {
		if (overrides.activeTrain) {
			trainService = createMockTrainService(overrides.activeTrain);
		}
		if (overrides.canvasExists !== undefined) {
			app = createMockApp(overrides.canvasExists);
		}
		if (overrides.canvasEnabled !== undefined) {
			getTrainSettings = createMockSettings(overrides.canvasEnabled);
		}
		registerTrainTimelineHandler(registry, {
			trainService: trainService as never,
			eventBus,
			app,
			getTrainSettings,
		});
	}

	it("registers the leaf:train-timeline handler", () => {
		register();
		expect(registry.getTabHandler("leaf:train-timeline")).toBeDefined();
	});

	it("creates flowti-train-timeline element", () => {
		register({ activeTrain: makeTrain() });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline");
		expect(el).not.toBeNull();
	});

	it("sets train to null when no active train", () => {
		register();
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { train: unknown };
		expect(el.train).toBeNull();
	});

	it("sets train data from trainService", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { train: TrainState };
		expect(el.train).toEqual(train);
	});

	it("computes graphRows from layout", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { graphRows: unknown[] };
		expect(el.graphRows.length).toBe(1);
	});

	it("computes branchCounts per thought", () => {
		const train = makeTrain();
		trainService = createMockTrainService(train);
		trainService.getBranches.mockImplementation(
			(_tid: string, nid: string) => nid === "t1" ? [makeThought({ id: "b1" })] : [],
		);
		registerTrainTimelineHandler(registry, {
			trainService: trainService as never,
			eventBus,
			app,
			getTrainSettings,
		});
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { branchCounts: Map<string, number> };
		expect(el.branchCounts.get("t1")).toBe(1);
	});

	it("sets canvasPath when canvas is enabled and folder exists", () => {
		const train = makeTrain();
		register({ activeTrain: train, canvasEnabled: true });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { canvasPath: string | null };
		expect(el.canvasPath).toBe("trains/test-train/Test Train.canvas");
	});

	it("sets canvasPath to null when canvas is disabled", () => {
		const train = makeTrain();
		register({ activeTrain: train, canvasEnabled: false });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { canvasPath: string | null };
		expect(el.canvasPath).toBeNull();
	});

	it("sets canvasExists based on vault lookup", () => {
		const train = makeTrain();
		register({ activeTrain: train, canvasExists: true });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline") as unknown as { canvasExists: boolean };
		expect(el.canvasExists).toBe(true);
	});

	it("wires thought-activated to eventBus", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline")!;
		el.dispatchEvent(new CustomEvent("thought-activated", {
			detail: { trainId: "train1", thoughtId: "t1" },
			bubbles: true,
		}));
		expect(eventBus.emit).toHaveBeenCalledWith("train.thought.activated", { trainId: "train1", thoughtId: "t1" });
		expect(eventBus.emit).toHaveBeenCalledWith("ui.openTrainView", { trainId: "train1" });
	});

	it("wires open-train-view to eventBus", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline")!;
		el.dispatchEvent(new CustomEvent("open-train-view", {
			detail: { trainId: "train1" },
			bubbles: true,
		}));
		expect(eventBus.emit).toHaveBeenCalledWith("ui.openTrainView", { trainId: "train1" });
	});

	it("wires cycle-branch-status to trainService.setBranchStatus", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline")!;
		el.dispatchEvent(new CustomEvent("cycle-branch-status", {
			detail: { trainId: "train1", thoughtId: "t1", currentStatus: null },
			bubbles: true,
		}));
		// null → exploring (next in cycle)
		expect(trainService.setBranchStatus).toHaveBeenCalledWith("train1", "t1", "exploring");
	});

	it("wires cycle-branch-status to clearBranchStatus when cycling past stale", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		const el = container.querySelector("flowti-train-timeline")!;
		el.dispatchEvent(new CustomEvent("cycle-branch-status", {
			detail: { trainId: "train1", thoughtId: "t1", currentStatus: "stale" },
			bubbles: true,
		}));
		// stale → null (clear)
		expect(trainService.clearBranchStatus).toHaveBeenCalledWith("train1", "t1");
	});

	it("clears container before rendering", () => {
		const train = makeTrain();
		register({ activeTrain: train });
		const container = document.createElement("div");
		container.innerHTML = "<p>old content</p>";
		registry.getTabHandler("leaf:train-timeline")!(container, { tabId: "timeline", viewId: "train-timeline", eventBus });
		expect(container.querySelector("p")).toBeNull();
		expect(container.querySelector("flowti-train-timeline")).not.toBeNull();
	});
});
