/**
 * TrainCanvasWriter — Generates and writes `.canvas` files from train graph state.
 *
 * Pure functions for canvas data generation (no I/O — testable without mocks).
 * Separate I/O function for file read/merge/write.
 *
 * Managed/User layer separation:
 *   - System-managed elements use deterministic IDs with `ft-` prefix.
 *   - On sync, all `ft-*` elements are replaced; non-`ft-*` elements preserved.
 */

import type { CanvasData, CanvasEdgeData, CanvasFileData } from "obsidian/canvas";
import type { TrainState } from "./types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";

// ── Layout Constants ──────────────────────────────────────────

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 60;
export const SPACING_Y = 120;
export const BRANCH_LANE_WIDTH = 300;

// ── ID Namespace ──────────────────────────────────────────────

const MANAGED_PREFIX = "ft-";
const NODE_PREFIX = "ft-t-";
const EDGE_PREFIX = "ft-e-";

export function nodeId(thoughtId: string): string {
	return `${NODE_PREFIX}${thoughtId}`;
}

export function edgeId(fromId: string, toId: string): string {
	return `${EDGE_PREFIX}${fromId}-${toId}`;
}

export function isManagedElement(id: string): boolean {
	return id.startsWith(MANAGED_PREFIX);
}

// ── Layout ────────────────────────────────────────────────────

interface NodePosition {
	x: number;
	y: number;
}

/**
 * Assign deterministic positions to each thought in the train.
 * DFS traversal: next children first (same lane), then branches (offset right).
 * Lane 0 = main chain, lane 1+ = branches.
 */
export function computeLayout(train: TrainState): Map<string, NodePosition> {
	const positions = new Map<string, NodePosition>();
	if (train.thoughts.length === 0) return positions;

	// Build adjacency: parentId → [{ childId, direction }]
	const children = new Map<string, Array<{ id: string; direction: string }>>();
	for (const r of train.relations) {
		if (r.direction === "next" || r.direction === "branch") {
			const list = children.get(r.fromId) ?? [];
			list.push({ id: r.toId, direction: r.direction });
			children.set(r.fromId, list);
		}
	}

	// Find root: thought with no incoming next/branch
	const hasIncoming = new Set(
		train.relations
			.filter((r) => r.direction === "next" || r.direction === "branch")
			.map((r) => r.toId),
	);
	const root = train.thoughts.find((t) => !hasIncoming.has(t.id)) ?? train.thoughts[0];

	let globalY = 0;

	function layout(thoughtId: string, lane: number): void {
		if (positions.has(thoughtId)) return;
		positions.set(thoughtId, { x: lane * BRANCH_LANE_WIDTH, y: globalY });
		globalY += SPACING_Y;

		const kids = children.get(thoughtId) ?? [];
		const nextKids = kids.filter((c) => c.direction === "next");
		const branchKids = kids.filter((c) => c.direction === "branch");

		for (const child of nextKids) {
			layout(child.id, lane);
		}
		for (let i = 0; i < branchKids.length; i++) {
			layout(branchKids[i].id, lane + 1 + i);
		}
	}

	layout(root.id, 0);

	// Handle orphan thoughts (not connected to root graph)
	for (const t of train.thoughts) {
		if (!positions.has(t.id)) {
			positions.set(t.id, { x: 0, y: globalY });
			globalY += SPACING_Y;
		}
	}

	return positions;
}

// ── Node Role Detection ───────────────────────────────────────

type NodeRole = "head" | "branch-origin" | "merge-target" | "normal";

/**
 * Determine the visual role of each thought for color coding.
 * Priority: head > merge-target > branch-origin > normal.
 */
export function computeNodeRoles(train: TrainState): Map<string, NodeRole> {
	const roles = new Map<string, NodeRole>();

	// Find head: walk main chain to the end
	const nextMap = new Map<string, string>();
	for (const r of train.relations) {
		if (r.direction === "next") nextMap.set(r.fromId, r.toId);
	}
	const incomingNext = new Set(
		train.relations.filter((r) => r.direction === "next").map((r) => r.toId),
	);
	const root = train.thoughts.find((t) => !incomingNext.has(t.id));
	if (root) {
		let current = root.id;
		while (nextMap.has(current)) {
			current = nextMap.get(current)!;
		}
		roles.set(current, "head");
	}

	// Collect merge targets and branch origins
	const mergeTargetIds = new Set(
		train.relations.filter((r) => r.direction === "merge").map((r) => r.toId),
	);
	const branchOriginIds = new Set(
		train.relations.filter((r) => r.direction === "branch").map((r) => r.fromId),
	);

	for (const t of train.thoughts) {
		if (roles.has(t.id)) continue;
		if (mergeTargetIds.has(t.id)) {
			roles.set(t.id, "merge-target");
		} else if (branchOriginIds.has(t.id)) {
			roles.set(t.id, "branch-origin");
		} else {
			roles.set(t.id, "normal");
		}
	}

	return roles;
}

const ROLE_COLOR: Record<NodeRole, string | undefined> = {
	"head": "5",          // green
	"branch-origin": "2", // orange
	"merge-target": "4",  // blue
	"normal": undefined,
};

// ── Canvas Generation ─────────────────────────────────────────

/**
 * Generate CanvasData from a train's graph state.
 * Pure function — no I/O.
 */
export function generateTrainCanvasData(train: TrainState): CanvasData {
	const positions = computeLayout(train);
	const roles = computeNodeRoles(train);

	const nodes = train.thoughts.map((t) => {
		const pos = positions.get(t.id) ?? { x: 0, y: 0 };
		const role = roles.get(t.id) ?? "normal";
		const color = ROLE_COLOR[role];

		const node: CanvasFileData = {
			id: nodeId(t.id),
			type: "file",
			file: t.path,
			x: pos.x,
			y: pos.y,
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
			...(color ? { color } : {}),
		};
		return node;
	});

	const edges = train.relations.map((r) => {
		const edge: CanvasEdgeData = {
			id: edgeId(r.fromId, r.toId),
			fromNode: nodeId(r.fromId),
			toNode: nodeId(r.toId),
			fromSide: r.direction === "branch" ? "right" : "bottom",
			toSide: "top",
		};
		if (r.direction === "branch") {
			edge.label = "branch";
		} else if (r.direction === "merge") {
			edge.label = "merge";
			edge.color = "4";
			edge.fromSide = "bottom";
			edge.toSide = "left";
		}
		return edge;
	});

	return { nodes, edges };
}

// ── Layer Merge ───────────────────────────────────────────────

/**
 * Merge managed canvas elements with user elements from existing canvas.
 * Managed elements (ft-* IDs) are replaced; user elements preserved.
 */
export function mergeCanvasLayers(
	managed: CanvasData,
	existing: CanvasData | null,
): CanvasData {
	if (!existing) return managed;

	const userNodes = existing.nodes.filter((n) => !isManagedElement(n.id));
	const userEdges = existing.edges.filter((e) => !isManagedElement(e.id));

	return {
		nodes: [...managed.nodes, ...userNodes],
		edges: [...managed.edges, ...userEdges],
	};
}

// ── I/O ───────────────────────────────────────────────────────

/**
 * Write train canvas to vault.
 * Reads existing canvas (if any), preserves user elements, writes merged result.
 */
export async function writeTrainCanvas(
	train: TrainState,
	canvasPath: string,
	fileSystem: IFileSystemClient,
): Promise<{ action: "created" | "updated"; path: string }> {
	const managed = generateTrainCanvasData(train);

	// Try to read existing canvas for user element preservation
	let existing: CanvasData | null = null;
	try {
		const exists = await fileSystem.fileExists(canvasPath);
		if (exists) {
			const content = await fileSystem.readFile(canvasPath);
			existing = JSON.parse(content) as CanvasData;
		}
	} catch {
		// No existing canvas or invalid JSON — will create new
	}

	const merged = mergeCanvasLayers(managed, existing);
	const json = JSON.stringify(merged, null, 2);

	const action = existing ? "updated" : "created";
	await fileSystem.createFile(canvasPath, json);

	return { action, path: canvasPath };
}
