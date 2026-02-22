import { describe, it, expect, vi } from "vitest";
import type { CanvasData, CanvasFileData } from "obsidian/canvas";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";
import {
	NODE_WIDTH,
	NODE_HEIGHT,
	SPACING_Y,
	BRANCH_LANE_WIDTH,
	nodeId,
	edgeId,
	isManagedElement,
	computeLayout,
	computeNodeRoles,
	generateTrainCanvasData,
	mergeCanvasLayers,
	writeTrainCanvas,
} from "../../../src/domain/train/TrainCanvasWriter";
import { createMockFileSystem } from "../../mocks/filesystem";

// ── Test helpers ──────────────────────────────────────────────

function makeThought(id: string, title: string, order: number): ThoughtNode {
	return {
		id,
		trainId: "train_1",
		title,
		path: `trains/${title}.md`,
		createdAt: new Date(2026, 1, 22, 10, 0, order).toISOString(),
		order,
	};
}

function makeTrain(
	thoughts: ThoughtNode[],
	relations: ThoughtRelation[],
): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "Test Train",
		status: "running",
		thoughts,
		relations,
		durationMinutes: 0,
		createdAt: "2026-02-22T10:00:00.000Z",
		pausedAt: null,
		completedAt: null,
	};
}

// ── ID generation ─────────────────────────────────────────────

describe("TrainCanvasWriter — ID generation", () => {
	it("nodeId uses ft-t- prefix", () => {
		expect(nodeId("thought_abc")).toBe("ft-t-thought_abc");
	});

	it("edgeId uses ft-e- prefix with from-to", () => {
		expect(edgeId("a", "b")).toBe("ft-e-a-b");
	});

	it("isManagedElement detects ft- prefix", () => {
		expect(isManagedElement("ft-t-abc")).toBe(true);
		expect(isManagedElement("ft-e-a-b")).toBe(true);
		expect(isManagedElement("user-node-123")).toBe(false);
		expect(isManagedElement("abc123def456")).toBe(false);
	});
});

// ── Layout ────────────────────────────────────────────────────

describe("TrainCanvasWriter — computeLayout()", () => {
	it("returns empty map for empty train", () => {
		const train = makeTrain([], []);
		expect(computeLayout(train).size).toBe(0);
	});

	it("single thought at origin", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);

		const layout = computeLayout(train);
		expect(layout.get("a")).toEqual({ x: 0, y: 0 });
	});

	it("main chain: vertical progression at lane 0", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const train = makeTrain(
			[a, b, c],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
			],
		);

		const layout = computeLayout(train);
		expect(layout.get("a")).toEqual({ x: 0, y: 0 });
		expect(layout.get("b")).toEqual({ x: 0, y: SPACING_Y });
		expect(layout.get("c")).toEqual({ x: 0, y: SPACING_Y * 2 });
	});

	it("branch offsets to the right", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D-branch", 2);
		const train = makeTrain(
			[a, b, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
			],
		);

		const layout = computeLayout(train);
		// A at (0,0), B at (0,120) — next stays in lane 0
		expect(layout.get("a")).toEqual({ x: 0, y: 0 });
		expect(layout.get("b")).toEqual({ x: 0, y: SPACING_Y });
		// D is branch from A → lane 1
		expect(layout.get("d")!.x).toBe(BRANCH_LANE_WIDTH);
	});

	it("multiple branches from same thought get different lanes", () => {
		const a = makeThought("a", "A", 0);
		const d = makeThought("d", "D", 1);
		const e = makeThought("e", "E", 2);
		const train = makeTrain(
			[a, d, e],
			[
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "a", toId: "e", direction: "branch" },
			],
		);

		const layout = computeLayout(train);
		expect(layout.get("d")!.x).toBe(BRANCH_LANE_WIDTH);
		expect(layout.get("e")!.x).toBe(BRANCH_LANE_WIDTH * 2);
	});

	it("handles orphan thoughts not connected to root", () => {
		const a = makeThought("a", "A", 0);
		const orphan = makeThought("z", "Orphan", 1);
		const train = makeTrain([a, orphan], []);

		const layout = computeLayout(train);
		expect(layout.has("a")).toBe(true);
		expect(layout.has("z")).toBe(true);
	});

	it("positions are deterministic across calls", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const d = makeThought("d", "D", 3);
		const train = makeTrain(
			[a, b, c, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
			],
		);

		const layout1 = computeLayout(train);
		const layout2 = computeLayout(train);
		for (const [id, pos1] of layout1) {
			expect(layout2.get(id)).toEqual(pos1);
		}
	});
});

// ── Node Roles ────────────────────────────────────────────────

describe("TrainCanvasWriter — computeNodeRoles()", () => {
	it("last thought in main chain is head", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const roles = computeNodeRoles(train);
		expect(roles.get("b")).toBe("head");
	});

	it("branch origin is branch-origin", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const train = makeTrain(
			[a, b, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
			],
		);

		const roles = computeNodeRoles(train);
		expect(roles.get("a")).toBe("branch-origin");
	});

	it("merge target is merge-target", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const d = makeThought("d", "D", 3);
		const train = makeTrain(
			[a, b, c, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "b", direction: "merge" },
			],
		);

		const roles = computeNodeRoles(train);
		// B is merge target but NOT head (C is head)
		expect(roles.get("b")).toBe("merge-target");
	});

	it("head takes priority over merge-target", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const train = makeTrain(
			[a, b, d],
			[
				{ fromId: "a", toId: "d", direction: "branch" },
				// b is head of main chain (only next-less thought on main)
				// Also merge target
				{ fromId: "d", toId: "a", direction: "merge" },
			],
		);

		// a has no incoming next, a is root. a has outgoing branch to d.
		// a is the last in the "next" chain (no outgoing next), so a = head.
		const roles = computeNodeRoles(train);
		expect(roles.get("a")).toBe("head"); // head > merge-target
	});

	it("normal thoughts have no special role", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const train = makeTrain(
			[a, b, c],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
			],
		);

		const roles = computeNodeRoles(train);
		expect(roles.get("a")).toBe("normal");
		expect(roles.get("b")).toBe("normal");
		expect(roles.get("c")).toBe("head");
	});
});

// ── Canvas Generation ─────────────────────────────────────────

describe("TrainCanvasWriter — generateTrainCanvasData()", () => {
	it("returns empty canvas for empty train", () => {
		const train = makeTrain([], []);
		const canvas = generateTrainCanvasData(train);
		expect(canvas.nodes).toEqual([]);
		expect(canvas.edges).toEqual([]);
	});

	it("generates file nodes with correct properties", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);

		const canvas = generateTrainCanvasData(train);
		expect(canvas.nodes).toHaveLength(1);
		const node = canvas.nodes[0] as CanvasFileData;
		expect(node.id).toBe("ft-t-a");
		expect(node.type).toBe("file");
		expect(node.file).toBe("trains/A.md");
		expect(node.width).toBe(NODE_WIDTH);
		expect(node.height).toBe(NODE_HEIGHT);
	});

	it("generates edges with deterministic IDs", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const canvas = generateTrainCanvasData(train);
		expect(canvas.edges).toHaveLength(1);
		expect(canvas.edges[0].id).toBe("ft-e-a-b");
		expect(canvas.edges[0].fromNode).toBe("ft-t-a");
		expect(canvas.edges[0].toNode).toBe("ft-t-b");
	});

	it("next edges: fromSide=bottom, toSide=top, no label", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.fromSide).toBe("bottom");
		expect(edge.toSide).toBe("top");
		expect(edge.label).toBeUndefined();
	});

	it("branch edges: fromSide=right, toSide=top, label='branch'", () => {
		const a = makeThought("a", "A", 0);
		const d = makeThought("d", "D", 1);
		const train = makeTrain(
			[a, d],
			[{ fromId: "a", toId: "d", direction: "branch" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.fromSide).toBe("right");
		expect(edge.toSide).toBe("top");
		expect(edge.label).toBe("branch");
	});

	it("merge edges: label='merge', color='4', toSide='left'", () => {
		const a = makeThought("a", "A", 0);
		const d = makeThought("d", "D", 1);
		const train = makeTrain(
			[a, d],
			[{ fromId: "d", toId: "a", direction: "merge" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.label).toBe("merge");
		expect(edge.color).toBe("4");
		expect(edge.fromSide).toBe("bottom");
		expect(edge.toSide).toBe("left");
	});

	it("head node colored green (5)", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const canvas = generateTrainCanvasData(train);
		const headNode = canvas.nodes.find((n) => n.id === "ft-t-b");
		expect((headNode as CanvasFileData).color).toBe("5");
	});

	it("branch origin colored orange (2)", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const train = makeTrain(
			[a, b, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
			],
		);

		const canvas = generateTrainCanvasData(train);
		const originNode = canvas.nodes.find((n) => n.id === "ft-t-a");
		expect((originNode as CanvasFileData).color).toBe("2");
	});

	it("merge target colored blue (4)", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const d = makeThought("d", "D", 3);
		const train = makeTrain(
			[a, b, c, d],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "b", direction: "merge" },
			],
		);

		const canvas = generateTrainCanvasData(train);
		// B is merge target (not head — C is head)
		const mergeNode = canvas.nodes.find((n) => n.id === "ft-t-b");
		expect((mergeNode as CanvasFileData).color).toBe("4");
	});

	it("normal thoughts have no color", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const train = makeTrain(
			[a, b, c],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
			],
		);

		const canvas = generateTrainCanvasData(train);
		const normalNode = canvas.nodes.find((n) => n.id === "ft-t-a");
		expect((normalNode as CanvasFileData).color).toBeUndefined();
	});

	it("node count matches thought count", () => {
		const thoughts = [
			makeThought("a", "A", 0),
			makeThought("b", "B", 1),
			makeThought("c", "C", 2),
		];
		const train = makeTrain(thoughts, [
			{ fromId: "a", toId: "b", direction: "next" },
			{ fromId: "b", toId: "c", direction: "next" },
		]);

		const canvas = generateTrainCanvasData(train);
		expect(canvas.nodes).toHaveLength(3);
	});

	it("edge count matches relation count", () => {
		const thoughts = [
			makeThought("a", "A", 0),
			makeThought("b", "B", 1),
			makeThought("d", "D", 2),
		];
		const relations: ThoughtRelation[] = [
			{ fromId: "a", toId: "b", direction: "next" },
			{ fromId: "a", toId: "d", direction: "branch" },
			{ fromId: "d", toId: "b", direction: "merge" },
		];
		const train = makeTrain(thoughts, relations);

		const canvas = generateTrainCanvasData(train);
		expect(canvas.edges).toHaveLength(3);
	});
});

// ── Layer Merge ───────────────────────────────────────────────

describe("TrainCanvasWriter — mergeCanvasLayers()", () => {
	it("returns managed data when no existing canvas", () => {
		const managed: CanvasData = {
			nodes: [{ id: "ft-t-a", type: "text", text: "A", x: 0, y: 0, width: 250, height: 60 }],
			edges: [],
		};
		const result = mergeCanvasLayers(managed, null);
		expect(result).toEqual(managed);
	});

	it("preserves user nodes from existing canvas", () => {
		const managed: CanvasData = {
			nodes: [{ id: "ft-t-a", type: "text", text: "A", x: 0, y: 0, width: 250, height: 60 }],
			edges: [],
		};
		const existing: CanvasData = {
			nodes: [
				{ id: "ft-t-old", type: "text", text: "Old managed", x: 0, y: 0, width: 250, height: 60 },
				{ id: "user-note-1", type: "text", text: "User note", x: 500, y: 500, width: 200, height: 100 },
			],
			edges: [],
		};

		const result = mergeCanvasLayers(managed, existing);
		// ft-t-old replaced by ft-t-a (managed layer rebuilt)
		// user-note-1 preserved
		expect(result.nodes).toHaveLength(2);
		expect(result.nodes.find((n) => n.id === "ft-t-a")).toBeDefined();
		expect(result.nodes.find((n) => n.id === "user-note-1")).toBeDefined();
		expect(result.nodes.find((n) => n.id === "ft-t-old")).toBeUndefined();
	});

	it("preserves user edges from existing canvas", () => {
		const managed: CanvasData = {
			nodes: [],
			edges: [{ id: "ft-e-a-b", fromNode: "ft-t-a", toNode: "ft-t-b" }],
		};
		const existing: CanvasData = {
			nodes: [],
			edges: [
				{ id: "ft-e-old", fromNode: "ft-t-x", toNode: "ft-t-y" },
				{ id: "user-edge-1", fromNode: "user-1", toNode: "user-2" },
			],
		};

		const result = mergeCanvasLayers(managed, existing);
		expect(result.edges).toHaveLength(2);
		expect(result.edges.find((e) => e.id === "ft-e-a-b")).toBeDefined();
		expect(result.edges.find((e) => e.id === "user-edge-1")).toBeDefined();
		expect(result.edges.find((e) => e.id === "ft-e-old")).toBeUndefined();
	});

	it("replaces all managed elements on each sync", () => {
		const managed1: CanvasData = {
			nodes: [{ id: "ft-t-a", type: "text", text: "V1", x: 0, y: 0, width: 250, height: 60 }],
			edges: [],
		};
		const managed2: CanvasData = {
			nodes: [
				{ id: "ft-t-a", type: "text", text: "V2", x: 0, y: 0, width: 250, height: 60 },
				{ id: "ft-t-b", type: "text", text: "New", x: 0, y: 120, width: 250, height: 60 },
			],
			edges: [],
		};

		// Simulate: first sync produces result, second sync replaces
		const afterFirst = mergeCanvasLayers(managed1, null);
		const afterSecond = mergeCanvasLayers(managed2, afterFirst);

		expect(afterSecond.nodes).toHaveLength(2);
		expect(afterSecond.nodes.find((n) => n.id === "ft-t-a")!.text).toBe("V2");
	});
});

// ── I/O — writeTrainCanvas ────────────────────────────────────

describe("TrainCanvasWriter — writeTrainCanvas()", () => {
	it("creates new canvas when no existing file", async () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		const fileSystem = createMockFileSystem();

		const result = await writeTrainCanvas(train, "trains/Test Train.canvas", fileSystem);

		expect(result.action).toBe("created");
		expect(result.path).toBe("trains/Test Train.canvas");
		expect(fileSystem.createFile).toHaveBeenCalledOnce();

		const written = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsed = JSON.parse(written[1] as string) as CanvasData;
		expect(parsed.nodes).toHaveLength(1);
		expect(parsed.nodes[0].id).toBe("ft-t-a");
	});

	it("updates existing canvas preserving user elements", async () => {
		const existingCanvas: CanvasData = {
			nodes: [
				{ id: "ft-t-old", type: "text", text: "Old", x: 0, y: 0, width: 250, height: 60 },
				{ id: "user-123", type: "text", text: "My note", x: 500, y: 500, width: 200, height: 100 },
			],
			edges: [],
		};

		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		const fileSystem = createMockFileSystem({
			"trains/Test Train.canvas": JSON.stringify(existingCanvas),
		});

		const result = await writeTrainCanvas(train, "trains/Test Train.canvas", fileSystem);

		expect(result.action).toBe("updated");

		const written = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsed = JSON.parse(written[1] as string) as CanvasData;
		// Managed element replaced, user element preserved
		expect(parsed.nodes.find((n) => n.id === "ft-t-a")).toBeDefined();
		expect(parsed.nodes.find((n) => n.id === "user-123")).toBeDefined();
		expect(parsed.nodes.find((n) => n.id === "ft-t-old")).toBeUndefined();
	});

	it("handles invalid JSON in existing canvas gracefully", async () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		const fileSystem = createMockFileSystem({
			"trains/Test Train.canvas": "not valid json{{{",
		});

		const result = await writeTrainCanvas(train, "trains/Test Train.canvas", fileSystem);

		// Falls back to creating fresh canvas
		expect(result.action).toBe("created");
		const written = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsed = JSON.parse(written[1] as string) as CanvasData;
		expect(parsed.nodes).toHaveLength(1);
	});

	it("writes valid JSON with indentation", async () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		const fileSystem = createMockFileSystem();

		await writeTrainCanvas(train, "trains/Test.canvas", fileSystem);

		const written = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		// JSON.stringify with indent produces multi-line output
		expect(written).toContain("\n");
		expect(() => JSON.parse(written)).not.toThrow();
	});
});

// ── Full pipeline ─────────────────────────────────────────────

describe("TrainCanvasWriter — full pipeline", () => {
	it("generates correct canvas for train with main chain + branch + merge", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const d = makeThought("d", "D-branch", 3);

		const relations: ThoughtRelation[] = [
			{ fromId: "a", toId: "b", direction: "next" },
			{ fromId: "b", toId: "c", direction: "next" },
			{ fromId: "a", toId: "d", direction: "branch" },
			{ fromId: "d", toId: "c", direction: "merge" },
		];

		const train = makeTrain([a, b, c, d], relations);
		const canvas = generateTrainCanvasData(train);

		// 4 nodes
		expect(canvas.nodes).toHaveLength(4);
		// 4 edges (2 next + 1 branch + 1 merge)
		expect(canvas.edges).toHaveLength(4);

		// Node roles
		const nodeA = canvas.nodes.find((n) => n.id === "ft-t-a")!;
		const nodeC = canvas.nodes.find((n) => n.id === "ft-t-c")!;
		const nodeD = canvas.nodes.find((n) => n.id === "ft-t-d")!;

		// A is branch-origin → orange
		expect((nodeA as CanvasFileData).color).toBe("2");
		// C is both head and merge-target → head wins (green)
		expect((nodeC as CanvasFileData).color).toBe("5");
		// D is normal (it's the merge source, not a special role)
		expect((nodeD as CanvasFileData).color).toBeUndefined();

		// Merge edge
		const mergeEdge = canvas.edges.find((e) => e.id === "ft-e-d-c");
		expect(mergeEdge).toBeDefined();
		expect(mergeEdge!.label).toBe("merge");
		expect(mergeEdge!.color).toBe("4");

		// Branch edge
		const branchEdge = canvas.edges.find((e) => e.id === "ft-e-a-d");
		expect(branchEdge).toBeDefined();
		expect(branchEdge!.label).toBe("branch");
		expect(branchEdge!.fromSide).toBe("right");

		// Layout: A at lane 0, D at lane 1
		expect(nodeA.x).toBe(0);
		expect(nodeD.x).toBe(BRANCH_LANE_WIDTH);
	});
});
