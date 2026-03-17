import { describe, it, expect, vi } from "vitest";
import type { CanvasData, CanvasFileData, CanvasGroupData } from "obsidian/canvas";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";
import {
	NODE_WIDTH,
	NODE_HEIGHT,
	SPACING_Y,
	BRANCH_LANE_WIDTH,
	GROUP_PREFIX,
	GROUP_PADDING,
	ANNOTATION_PREFIX,
	ROLE_COLOR,
	nodeId,
	edgeId,
	groupId,
	annotationId,
	isManagedElement,
	computeLayout,
	computeNodeRoles,
	computeGroups,
	computeAnnotations,
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

	it("isManagedElement detects ft- prefix (nodes, edges, groups, annotations)", () => {
		expect(isManagedElement("ft-t-abc")).toBe(true);
		expect(isManagedElement("ft-e-a-b")).toBe(true);
		expect(isManagedElement("ft-g-main")).toBe(true);
		expect(isManagedElement("ft-a-header")).toBe(true);
		expect(isManagedElement("user-node-123")).toBe(false);
		expect(isManagedElement("abc123def456")).toBe(false);
	});

	it("groupId uses ft-g- prefix", () => {
		expect(groupId("main")).toBe("ft-g-main");
		expect(groupId("branch-abc")).toBe("ft-g-branch-abc");
	});

	it("annotationId uses ft-a- prefix", () => {
		expect(annotationId("header")).toBe("ft-a-header");
		expect(annotationId("branch-abc")).toBe("ft-a-branch-abc");
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
		// A at (0,0), B at (0,SPACING_Y) — next stays in lane 0
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
		expect(roles.get("a")).toBe("root");
		expect(roles.get("b")).toBe("normal");
		expect(roles.get("c")).toBe("head");
	});

	it("root: first thought with no incoming edges gets yellow", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const roles = computeNodeRoles(train);
		expect(roles.get("a")).toBe("root");
		expect(ROLE_COLOR["root"]).toBe("3");
	});

	it("root: single thought is normal (not root)", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);

		const roles = computeNodeRoles(train);
		// Single thought is head (walk from root to end = itself)
		expect(roles.get("a")).toBe("head");
	});

	it("leaf: branch endpoint with no outgoing edges gets purple", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const e = makeThought("e", "E", 3);
		const train = makeTrain(
			[a, b, d, e],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "e", direction: "next" },
			],
		);

		const roles = computeNodeRoles(train);
		// e: has incoming next, no outgoing → leaf
		expect(roles.get("e")).toBe("leaf");
		expect(ROLE_COLOR["leaf"]).toBe("1");
	});

	it("merge-source: thought with outgoing merge edge", () => {
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
		expect(roles.get("d")).toBe("merge-source");
		expect(ROLE_COLOR["merge-source"]).toBe("#a855f7");
	});

	it("priority: head > merge-target > merge-source > branch-origin > root > leaf > normal", () => {
		// head already tested above (head > merge-target)

		// merge-target > merge-source: a node that is both merge target and source
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const c = makeThought("c", "C", 2);
		const d = makeThought("d", "D", 3);
		const e = makeThought("e", "E", 4);
		const train = makeTrain(
			[a, b, c, d, e],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "b", direction: "merge" }, // d is merge-source, b is merge-target
				{ fromId: "b", toId: "e", direction: "branch" },
				{ fromId: "e", toId: "c", direction: "merge" }, // e is merge-source, c is head (not merge-target)
			],
		);

		const roles = computeNodeRoles(train);
		// b: is merge-target AND branch-origin → merge-target wins
		expect(roles.get("b")).toBe("merge-target");
		// d: is merge-source → merge-source
		expect(roles.get("d")).toBe("merge-source");
		// a: is branch-origin AND root → branch-origin wins (higher priority)
		expect(roles.get("a")).toBe("branch-origin");
	});

	it("branch-origin > root priority", () => {
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
		// a is both root (no incoming) and branch-origin → branch-origin wins
		expect(roles.get("a")).toBe("branch-origin");
	});

	it("all 7 role colors are defined", () => {
		const roles: Array<string> = ["head", "merge-target", "merge-source", "branch-origin", "root", "leaf", "normal"];
		for (const role of roles) {
			expect(role in ROLE_COLOR).toBe(true);
		}
		// normal has no color
		expect(ROLE_COLOR["normal"]).toBeUndefined();
		// All others have colors
		expect(ROLE_COLOR["head"]).toBe("5");
		expect(ROLE_COLOR["merge-target"]).toBe("4");
		expect(ROLE_COLOR["merge-source"]).toBe("#a855f7");
		expect(ROLE_COLOR["branch-origin"]).toBe("2");
		expect(ROLE_COLOR["root"]).toBe("3");
		expect(ROLE_COLOR["leaf"]).toBe("1");
	});
});

// ── Groups ───────────────────────────────────────────────────

describe("TrainCanvasWriter — computeGroups()", () => {
	it("returns empty array for empty train", () => {
		const train = makeTrain([], []);
		const positions = computeLayout(train);
		expect(computeGroups(train, positions)).toEqual([]);
	});

	it("returns empty array for single-thought train", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		const positions = computeLayout(train);
		expect(computeGroups(train, positions)).toEqual([]);
	});

	it("creates main chain group for linear chain", () => {
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

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);

		expect(groups).toHaveLength(1);
		expect(groups[0].id).toBe("ft-g-main");
		expect(groups[0].label).toBe("Main Chain");
		expect(groups[0].color).toBe("3");
		expect(groups[0].type).toBe("group");
	});

	it("main chain bounding box includes all nodes with padding", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);
		const main = groups[0];

		// A at (0,0), B at (0,SPACING_Y)
		expect(main.x).toBe(0 - GROUP_PADDING);
		expect(main.y).toBe(0 - GROUP_PADDING);
		expect(main.width).toBe(NODE_WIDTH + GROUP_PADDING * 2);
		expect(main.height).toBe(SPACING_Y + NODE_HEIGHT + GROUP_PADDING * 2);
	});

	it("creates branch group for each branch", () => {
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

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);

		// Main chain (a, b) + branch group (d)
		expect(groups).toHaveLength(2);
		const mainGroup = groups.find((g) => g.id === "ft-g-main");
		const branchGroup = groups.find((g) => g.id === "ft-g-branch-a");

		expect(mainGroup).toBeDefined();
		expect(branchGroup).toBeDefined();
		expect(branchGroup!.label).toBe("Branch from: A");
		expect(branchGroup!.color).toBe("2");
	});

	it("branch group contains all descendants (next + nested branch)", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const e = makeThought("e", "E", 3);
		const train = makeTrain(
			[a, b, d, e],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "e", direction: "next" },
			],
		);

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);
		const branchGroup = groups.find((g) => g.id === "ft-g-branch-a");

		// Branch should contain d and e
		expect(branchGroup).toBeDefined();
		const posD = positions.get("d")!;
		const posE = positions.get("e")!;
		// Both d and e should be within the bounding box
		expect(branchGroup!.x).toBeLessThanOrEqual(posD.x);
		expect(branchGroup!.y).toBeLessThanOrEqual(posD.y);
		expect(branchGroup!.x).toBeLessThanOrEqual(posE.x);
		expect(branchGroup!.y).toBeLessThanOrEqual(posE.y);
	});

	it("branch bounding box has correct padding", () => {
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

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);
		const branchGroup = groups.find((g) => g.id === "ft-g-branch-a")!;
		const posD = positions.get("d")!;

		// Single-node branch: bounding box = node + padding
		expect(branchGroup.x).toBe(posD.x - GROUP_PADDING);
		expect(branchGroup.y).toBe(posD.y - GROUP_PADDING);
		expect(branchGroup.width).toBe(NODE_WIDTH + GROUP_PADDING * 2);
		expect(branchGroup.height).toBe(NODE_HEIGHT + GROUP_PADDING * 2);
	});

	it("multiple branches from same origin create separate groups", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const e = makeThought("e", "E", 3);
		const train = makeTrain(
			[a, b, d, e],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "a", toId: "e", direction: "branch" },
			],
		);

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);

		// Main chain + 2 branch groups (both from a, but each gets own group per relation)
		const branchGroups = groups.filter((g) => g.id.startsWith("ft-g-branch-"));
		expect(branchGroups).toHaveLength(2);
	});

	it("group IDs are managed elements", () => {
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

		const positions = computeLayout(train);
		const groups = computeGroups(train, positions);

		for (const group of groups) {
			expect(isManagedElement(group.id)).toBe(true);
			expect(group.id.startsWith(GROUP_PREFIX)).toBe(true);
		}
	});

	it("groups appear in generated canvas data", () => {
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
		const groupNodes = canvas.nodes.filter((n) => n.type === "group") as CanvasGroupData[];
		expect(groupNodes.length).toBeGreaterThanOrEqual(2); // main + branch
	});
});

// ── Annotations ──────────────────────────────────────────────

describe("TrainCanvasWriter — computeAnnotations()", () => {
	it("returns empty for empty train", () => {
		const train = makeTrain([], []);
		const positions = computeLayout(train);
		expect(computeAnnotations(train, positions)).toEqual([]);
	});

	it("creates header annotation above root node", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);
		const header = annotations.find((a) => a.id === "ft-a-header");

		expect(header).toBeDefined();
		expect(header!.type).toBe("text");
		expect(header!.text).toContain("# Test Train");
		expect(header!.text).toContain("running");
		expect(header!.text).toContain("2");
		// Positioned above root
		expect(header!.y).toBeLessThan(0);
	});

	it("header shows duration when > 0", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);
		train.durationMinutes = 45;

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);
		const header = annotations.find((a) => a.id === "ft-a-header");

		expect(header!.text).toContain("45 min");
	});

	it("header shows 'in progress' when duration is 0", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);
		const header = annotations.find((a) => a.id === "ft-a-header");

		expect(header!.text).toContain("in progress");
	});

	it("creates branch annotations near branch start", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const d = makeThought("d", "D", 2);
		const e = makeThought("e", "E", 3);
		const train = makeTrain(
			[a, b, d, e],
			[
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "a", toId: "d", direction: "branch" },
				{ fromId: "d", toId: "e", direction: "next" },
			],
		);

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);
		const branchAnnotation = annotations.find((a) => a.id === "ft-a-branch-a");

		expect(branchAnnotation).toBeDefined();
		expect(branchAnnotation!.text).toBe("Branch (2 thoughts)");
	});

	it("singular 'thought' for single-node branch", () => {
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

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);
		const branchAnnotation = annotations.find((a) => a.id === "ft-a-branch-a");

		expect(branchAnnotation!.text).toBe("Branch (1 thought)");
	});

	it("annotation IDs are managed elements", () => {
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

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);

		for (const ann of annotations) {
			expect(isManagedElement(ann.id)).toBe(true);
			expect(ann.id.startsWith(ANNOTATION_PREFIX)).toBe(true);
		}
	});

	it("annotations appear in generated canvas data", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const canvas = generateTrainCanvasData(train);
		const textNodes = canvas.nodes.filter((n) => n.type === "text");
		expect(textNodes.length).toBeGreaterThanOrEqual(1); // at least header
	});

	it("single thought gets header annotation", () => {
		const a = makeThought("a", "A", 0);
		const train = makeTrain([a], []);

		const positions = computeLayout(train);
		const annotations = computeAnnotations(train, positions);

		expect(annotations).toHaveLength(1);
		expect(annotations[0].id).toBe("ft-a-header");
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
		const fileNodes = canvas.nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(1);
		const node = fileNodes[0] as CanvasFileData;
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

	it("next edges: fromSide=bottom, toSide=top, arrow, no label/color", () => {
		const a = makeThought("a", "A", 0);
		const b = makeThought("b", "B", 1);
		const train = makeTrain(
			[a, b],
			[{ fromId: "a", toId: "b", direction: "next" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.fromSide).toBe("bottom");
		expect(edge.toSide).toBe("top");
		expect(edge.fromEnd).toBe("none");
		expect(edge.toEnd).toBe("arrow");
		expect(edge.label).toBeUndefined();
		expect(edge.color).toBeUndefined();
	});

	it("branch edges: fromSide=right, toSide=top, arrow, orange, label='branch'", () => {
		const a = makeThought("a", "A", 0);
		const d = makeThought("d", "D", 1);
		const train = makeTrain(
			[a, d],
			[{ fromId: "a", toId: "d", direction: "branch" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.fromSide).toBe("right");
		expect(edge.toSide).toBe("top");
		expect(edge.fromEnd).toBe("none");
		expect(edge.toEnd).toBe("arrow");
		expect(edge.label).toBe("branch");
		expect(edge.color).toBe("2"); // orange
	});

	it("merge edges: fromSide=right, toSide=left, arrow, blue, label='merge'", () => {
		const a = makeThought("a", "A", 0);
		const d = makeThought("d", "D", 1);
		const train = makeTrain(
			[a, d],
			[{ fromId: "d", toId: "a", direction: "merge" }],
		);

		const edge = generateTrainCanvasData(train).edges[0];
		expect(edge.label).toBe("merge");
		expect(edge.color).toBe("4"); // blue
		expect(edge.fromSide).toBe("right");
		expect(edge.toSide).toBe("left");
		expect(edge.fromEnd).toBe("none");
		expect(edge.toEnd).toBe("arrow");
	});

	it("all edge types have arrow heads", () => {
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
		for (const edge of canvas.edges) {
			expect(edge.toEnd).toBe("arrow");
			expect(edge.fromEnd).toBe("none");
		}
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
		// b is the only "normal" role in this chain (a=root, c=head)
		const normalNode = canvas.nodes.find((n) => n.id === "ft-t-b");
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
		const fileNodes = canvas.nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(3);
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
		const fileNodes = parsed.nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(1);
		expect(fileNodes[0].id).toBe("ft-t-a");
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
		expect(fileSystem.updateFile).toHaveBeenCalledOnce();
		expect(fileSystem.createFile).not.toHaveBeenCalled();

		const written = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
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

		// File exists so action is "updated", even though JSON was invalid
		expect(result.action).toBe("updated");
		expect(fileSystem.updateFile).toHaveBeenCalledOnce();
		expect(fileSystem.createFile).not.toHaveBeenCalled();
		const written = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsed = JSON.parse(written[1] as string) as CanvasData;
		const fileNodes = parsed.nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(1);
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

		// 4 file nodes + groups
		const fileNodes = canvas.nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(4);
		// Groups: main chain + branch
		const groupNodes = canvas.nodes.filter((n) => n.type === "group");
		expect(groupNodes.length).toBeGreaterThanOrEqual(2);
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
		// D is merge-source → purple hex
		expect((nodeD as CanvasFileData).color).toBe("#a855f7");

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
