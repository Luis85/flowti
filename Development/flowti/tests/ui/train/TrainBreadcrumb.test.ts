// @vitest-environment happy-dom
/**
 * Inc 4: TrainBreadcrumbPanel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainBreadcrumbPanel } from "../../../src/ui/train/TrainBreadcrumbPanel";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";
import type { TrainPanelDeps } from "../../../src/ui/train/types";
import type { TrainService } from "../../../src/domain/train/TrainService";

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
		...overrides,
	};
}

function createDeps(): { deps: TrainPanelDeps; eventBus: EventBus } {
	const eventBus = new EventBus();
	return {
		deps: {
			trainService: {
				getTrain: vi.fn(),
				getTimeline: vi.fn(() => []),
				getBranches: vi.fn(() => []),
				getChildren: vi.fn(() => []),
				getAllTrains: vi.fn(() => []),
			} as unknown as TrainService,
			eventBus,
			scheduleRender: vi.fn(),
		},
		eventBus,
	};
}

// ── Tests ────────────────────────────────────────────────

describe("TrainBreadcrumbPanel", () => {
	let el: HTMLDivElement;

	beforeEach(() => {
		el = document.createElement("div");
	});

	it("renders nothing when no active thought", () => {
		const { deps } = createDeps();
		const train = createTrain();

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, null);

		expect(el.children.length).toBe(0);
	});

	it("renders single segment for root thought", () => {
		const { deps } = createDeps();
		const root = createThought({ id: "root", title: "Root Idea" });
		const train = createTrain({ thoughts: [root], relations: [] });

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, root);

		const rows = el.querySelectorAll(".ft-train-breadcrumb-row");
		expect(rows.length).toBe(1);

		const segment = rows[0].querySelector(".ft-train-breadcrumb-segment");
		expect(segment?.textContent).toBe("Root Idea");

		const marker = rows[0].querySelector(".ft-train-breadcrumb-marker");
		expect(marker?.textContent).toBe("Start");

		expect(rows[0].classList.contains("ft-train-breadcrumb-active")).toBe(true);
	});

	it("renders full path for deeply nested thought", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1", title: "Root" });
		const t2 = createThought({ id: "t2", title: "Middle" });
		const t3 = createThought({ id: "t3", title: "Leaf" });
		const train = createTrain({
			thoughts: [t1, t2, t3],
			relations: [
				{ fromId: "t1", toId: "t2", direction: "next" },
				{ fromId: "t2", toId: "t3", direction: "branch" },
			],
		});

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, t3);

		const segments = el.querySelectorAll(".ft-train-breadcrumb-segment");
		expect(segments.length).toBe(3);
		expect(segments[0].textContent).toBe("Root");
		expect(segments[1].textContent).toBe("Middle");
		expect(segments[2].textContent).toBe("Leaf");
	});

	it("marks only the last row as active", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1", title: "Root" });
		const t2 = createThought({ id: "t2", title: "Leaf" });
		const train = createTrain({
			thoughts: [t1, t2],
			relations: [{ fromId: "t1", toId: "t2", direction: "next" }],
		});

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, t2);

		const rows = el.querySelectorAll(".ft-train-breadcrumb-row");
		expect(rows[0].classList.contains("ft-train-breadcrumb-active")).toBe(false);
		expect(rows[1].classList.contains("ft-train-breadcrumb-active")).toBe(true);
	});

	it("renders step markers for each row", () => {
		const { deps } = createDeps();
		const t1 = createThought({ id: "t1", title: "A" });
		const t2 = createThought({ id: "t2", title: "B" });
		const t3 = createThought({ id: "t3", title: "C" });
		const train = createTrain({
			thoughts: [t1, t2, t3],
			relations: [
				{ fromId: "t1", toId: "t2", direction: "next" },
				{ fromId: "t2", toId: "t3", direction: "next" },
			],
		});

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, t3);

		const markers = el.querySelectorAll(".ft-train-breadcrumb-marker");
		expect(markers.length).toBe(3);
		expect(markers[0].textContent).toBe("Start");
		expect(markers[1].textContent).toBe("2");
		expect(markers[2].textContent).toBe("3");
	});

	it("emits train.thought.activated when non-active segment clicked", async () => {
		const { deps, eventBus } = createDeps();
		const handler = vi.fn();
		eventBus.on("train.thought.activated", handler);

		const t1 = createThought({ id: "t1", title: "Root" });
		const t2 = createThought({ id: "t2", title: "Leaf" });
		const train = createTrain({
			thoughts: [t1, t2],
			relations: [{ fromId: "t1", toId: "t2", direction: "next" }],
		});

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, t2);

		// Click the first (non-active) segment
		const segments = el.querySelectorAll(".ft-train-breadcrumb-segment");
		(segments[0] as HTMLElement).click();

		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0][0].payload).toEqual({
			trainId: "train_1",
			thoughtId: "t1",
		});
	});

	it("empties on re-render", () => {
		const { deps } = createDeps();
		const root = createThought({ id: "root", title: "Root" });
		const train = createTrain({ thoughts: [root], relations: [] });

		const panel = new TrainBreadcrumbPanel(el, deps);
		panel.render(train, root);
		panel.render(train, root);

		const breadcrumbs = el.querySelectorAll(".ft-train-breadcrumb");
		expect(breadcrumbs.length).toBe(1);
	});
});
