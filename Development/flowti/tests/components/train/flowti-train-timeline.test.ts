// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/train/flowti-train-timeline";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";
import type { GraphRow } from "../../../src/domain/train/graph-layout";
import { LANE_COLORS } from "../../../src/domain/train/graph-layout";

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

function makeGraphRow(overrides: Partial<GraphRow> = {}): GraphRow {
	const activeLanes = new Map<number, string>();
	activeLanes.set(0, LANE_COLORS[0]);
	return {
		thought: makeThought(),
		lane: 0,
		activeLanes,
		isBranchStart: false,
		parentLane: 0,
		...overrides,
	};
}

type TimelineElement = HTMLElement & {
	train: TrainState | null;
	timeline: ThoughtNode[];
	activeThoughtId: string | null;
	graphRows: GraphRow[];
	branchCounts: Map<string, number>;
	canvasPath: string | null;
	canvasExists: boolean;
	collapsedNodes: Set<string>;
	updateComplete: Promise<boolean>;
};

describe("flowti-train-timeline", () => {
	let el: TimelineElement;

	beforeEach(() => {
		el = document.createElement("flowti-train-timeline") as TimelineElement;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-train-timeline")).toBeDefined();
	});

	it("renders empty state when train is null", async () => {
		el.train = null;
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".timeline-empty")).not.toBeNull();
		expect(shadow.textContent).toContain("No active train");
	});

	it("renders header with train title and status", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".timeline-header")).not.toBeNull();
		expect(shadow.textContent).toContain("Test Train");
		expect(shadow.textContent).toContain("running");
	});

	it("renders stat line with thought count", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const statLine = shadow.querySelector(".stat-line");
		expect(statLine).not.toBeNull();
		expect(statLine!.textContent).toContain("1 thoughts");
	});

	it("renders empty-chain message when graphRows is empty", async () => {
		el.train = makeTrain();
		el.timeline = [];
		el.graphRows = [];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".empty-chain")).not.toBeNull();
		expect(shadow.textContent).toContain("No thoughts yet");
	});

	it("renders graph nodes for each row", async () => {
		const t1 = makeThought({ id: "t1", title: "Thought 1" });
		const t2 = makeThought({ id: "t2", title: "Thought 2", order: 1 });
		const train = makeTrain({ thoughts: [t1, t2] });
		const rows = [
			makeGraphRow({ thought: t1 }),
			makeGraphRow({ thought: t2 }),
		];
		el.train = train;
		el.timeline = [t1, t2];
		el.graphRows = rows;
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const nodes = shadow.querySelectorAll(".graph-node");
		expect(nodes.length).toBe(2);
	});

	it("marks the active thought node", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		el.activeThoughtId = "t1";
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const active = shadow.querySelector(".graph-node--active");
		expect(active).not.toBeNull();
	});

	it("renders graph dot for each node", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const dot = shadow.querySelector(".graph-dot");
		expect(dot).not.toBeNull();
	});

	it("renders thought title in content area", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const title = shadow.querySelector(".node-title");
		expect(title).not.toBeNull();
		expect(title!.textContent).toContain("First thought");
	});

	it("shows branch badge when branchCount > 0", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map([["t1", 2]]);
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".branch-badge");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("+2");
	});

	it("shows collapse chevron when thought has branches", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map([["t1", 1]]);
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const chevron = shadow.querySelector(".chevron");
		expect(chevron).not.toBeNull();
	});

	it("shows canvas button when canvasPath and canvasExists", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		el.canvasPath = "trains/test.canvas";
		el.canvasExists = true;
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const canvasBtn = shadow.querySelector("[data-action='open-canvas']");
		expect(canvasBtn).not.toBeNull();
	});

	it("hides canvas button when canvasExists is false", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		el.canvasPath = "trains/test.canvas";
		el.canvasExists = false;
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const canvasBtn = shadow.querySelector("[data-action='open-canvas']");
		expect(canvasBtn).toBeNull();
	});

	// ── Event emission tests ──────────────────────────

	it("dispatches thought-activated on node click", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		let detail: unknown = null;
		el.addEventListener("thought-activated", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const shadow = el.shadowRoot!;
		const node = shadow.querySelector(".graph-node") as HTMLElement;
		node.click();
		expect(detail).toEqual({ trainId: "train1", thoughtId: "t1" });
	});

	it("dispatches open-train-view on header button click", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		await el.updateComplete;

		let detail: unknown = null;
		el.addEventListener("open-train-view", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("[data-action='open-train']") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ trainId: "train1" });
	});

	it("dispatches open-canvas on canvas button click", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map();
		el.canvasPath = "trains/test.canvas";
		el.canvasExists = true;
		await el.updateComplete;

		let detail: unknown = null;
		el.addEventListener("open-canvas", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("[data-action='open-canvas']") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ canvasPath: "trains/test.canvas" });
	});

	it("dispatches toggle-collapse on chevron click", async () => {
		const train = makeTrain();
		el.train = train;
		el.timeline = train.thoughts;
		el.graphRows = [makeGraphRow()];
		el.branchCounts = new Map([["t1", 1]]);
		await el.updateComplete;

		let detail: unknown = null;
		el.addEventListener("toggle-collapse", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const shadow = el.shadowRoot!;
		const chevron = shadow.querySelector("[data-action='toggle-collapse']") as HTMLElement;
		chevron.click();
		expect(detail).toEqual({ thoughtId: "t1" });
	});

	it("dispatches cycle-branch-status on status badge click", async () => {
		const thought = makeThought({ id: "b1", branchStatus: "exploring" });
		const train = makeTrain({
			thoughts: [thought],
			relations: [{ fromId: "t1", toId: "b1", direction: "branch" }],
		});
		const activeLanes = new Map<number, string>();
		activeLanes.set(0, LANE_COLORS[0]);
		el.train = train;
		el.timeline = [thought];
		el.graphRows = [makeGraphRow({ thought })];
		el.branchCounts = new Map();
		await el.updateComplete;

		let detail: unknown = null;
		el.addEventListener("cycle-branch-status", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector("[data-action='cycle-status']") as HTMLElement;
		badge.click();
		expect(detail).toEqual({ trainId: "train1", thoughtId: "b1", currentStatus: "exploring" });
	});

	it("shows merge badges for merge relations", async () => {
		const t1 = makeThought({ id: "t1", title: "Origin" });
		const t2 = makeThought({ id: "t2", title: "Target", order: 1 });
		const train = makeTrain({
			thoughts: [t1, t2],
			relations: [{ fromId: "t1", toId: "t2", direction: "merge" }],
		});
		el.train = train;
		el.timeline = [t1, t2];
		el.graphRows = [
			makeGraphRow({ thought: t1 }),
			makeGraphRow({ thought: t2 }),
		];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const outgoing = shadow.querySelector(".merge-badge--outgoing");
		const incoming = shadow.querySelector(".merge-badge--incoming");
		expect(outgoing).not.toBeNull();
		expect(incoming).not.toBeNull();
	});

	it("renders fork connector for branch start", async () => {
		const thought = makeThought();
		const activeLanes = new Map<number, string>();
		activeLanes.set(0, LANE_COLORS[0]);
		activeLanes.set(1, LANE_COLORS[1]);
		const row = makeGraphRow({
			thought,
			lane: 1,
			activeLanes,
			isBranchStart: true,
			parentLane: 0,
		});
		const train = makeTrain();
		el.train = train;
		el.timeline = [thought];
		el.graphRows = [row];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const fork = shadow.querySelector(".graph-fork");
		expect(fork).not.toBeNull();
	});

	it("renders rails for active lanes", async () => {
		const thought = makeThought();
		const activeLanes = new Map<number, string>();
		activeLanes.set(0, LANE_COLORS[0]);
		activeLanes.set(1, LANE_COLORS[1]);
		const row = makeGraphRow({ thought, activeLanes });
		const train = makeTrain();
		el.train = train;
		el.timeline = [thought];
		el.graphRows = [row];
		el.branchCounts = new Map();
		await el.updateComplete;

		const shadow = el.shadowRoot!;
		const rails = shadow.querySelectorAll(".graph-rail");
		expect(rails.length).toBe(2);
	});
});
