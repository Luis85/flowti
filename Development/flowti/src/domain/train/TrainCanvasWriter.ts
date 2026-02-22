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

import type { CanvasData, CanvasEdgeData, CanvasFileData, CanvasGroupData, CanvasTextData, AllCanvasNodeData } from "obsidian/canvas";
import type { TrainState } from "./types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";

// ── Layout Constants ──────────────────────────────────────────

export const NODE_WIDTH = 400;
export const NODE_HEIGHT = 200;
export const SPACING_Y = 280;
export const BRANCH_LANE_WIDTH = 500;

// ── ID Namespace ──────────────────────────────────────────────

const MANAGED_PREFIX = "ft-";
const NODE_PREFIX = "ft-t-";
const EDGE_PREFIX = "ft-e-";
export const GROUP_PREFIX = "ft-g-";
export const ANNOTATION_PREFIX = "ft-a-";
export const GROUP_PADDING = 40;

export function nodeId(thoughtId: string): string {
	return `${NODE_PREFIX}${thoughtId}`;
}

export function edgeId(fromId: string, toId: string): string {
	return `${EDGE_PREFIX}${fromId}-${toId}`;
}

export function groupId(key: string): string {
	return `${GROUP_PREFIX}${key}`;
}

export function annotationId(key: string): string {
	return `${ANNOTATION_PREFIX}${key}`;
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

export type NodeRole = "head" | "merge-target" | "merge-source" | "branch-origin" | "root" | "leaf" | "normal";

/**
 * Determine the visual role of each thought for color coding.
 * Priority: head > merge-target > merge-source > branch-origin > root > leaf > normal.
 */
export function computeNodeRoles(train: TrainState): Map<string, NodeRole> {
	const roles = new Map<string, NodeRole>();

	// Build relation sets
	const nextMap = new Map<string, string>();
	for (const r of train.relations) {
		if (r.direction === "next") nextMap.set(r.fromId, r.toId);
	}
	const mergeTargetIds = new Set(
		train.relations.filter((r) => r.direction === "merge").map((r) => r.toId),
	);
	const mergeSourceIds = new Set(
		train.relations.filter((r) => r.direction === "merge").map((r) => r.fromId),
	);
	const branchOriginIds = new Set(
		train.relations.filter((r) => r.direction === "branch").map((r) => r.fromId),
	);

	// Find root: thought with no incoming next/branch edges
	const hasIncoming = new Set(
		train.relations
			.filter((r) => r.direction === "next" || r.direction === "branch")
			.map((r) => r.toId),
	);
	const rootThought = train.thoughts.find((t) => !hasIncoming.has(t.id));
	const rootId = rootThought?.id;

	// Find head: walk main chain from root to the end
	let headId: string | undefined;
	if (rootThought) {
		let current = rootThought.id;
		while (nextMap.has(current)) {
			current = nextMap.get(current)!;
		}
		headId = current;
	}

	// Find leaves: branch endpoints with no outgoing next or branch edges
	const hasOutgoing = new Set(
		train.relations
			.filter((r) => r.direction === "next" || r.direction === "branch")
			.map((r) => r.fromId),
	);

	// Assign roles by priority: head > merge-target > merge-source > branch-origin > root > leaf > normal
	for (const t of train.thoughts) {
		if (t.id === headId) {
			roles.set(t.id, "head");
		} else if (mergeTargetIds.has(t.id)) {
			roles.set(t.id, "merge-target");
		} else if (mergeSourceIds.has(t.id)) {
			roles.set(t.id, "merge-source");
		} else if (branchOriginIds.has(t.id)) {
			roles.set(t.id, "branch-origin");
		} else if (t.id === rootId && train.thoughts.length > 1) {
			roles.set(t.id, "root");
		} else if (!hasOutgoing.has(t.id) && hasIncoming.has(t.id)) {
			roles.set(t.id, "leaf");
		} else {
			roles.set(t.id, "normal");
		}
	}

	return roles;
}

export const ROLE_COLOR: Record<NodeRole, string | undefined> = {
	"head": "5",            // green
	"merge-target": "4",    // blue
	"merge-source": "#a855f7", // purple (custom hex — distinct from built-in "1")
	"branch-origin": "2",  // orange
	"root": "3",            // yellow
	"leaf": "1",            // purple (built-in)
	"normal": undefined,
};

// ── Groups ───────────────────────────────────────────────────

interface GroupSpec {
	id: string;
	label: string;
	color: string;
	memberIds: string[];
}

/**
 * Compute canvas groups for main chain and branches.
 * Returns group specs with bounding boxes computed from node positions.
 */
export function computeGroups(
	train: TrainState,
	positions: Map<string, NodePosition>,
): CanvasGroupData[] {
	if (train.thoughts.length < 2) return [];

	// Build adjacency for next and branch
	const nextChildren = new Map<string, string[]>();
	const branchChildren = new Map<string, string[]>();
	for (const r of train.relations) {
		if (r.direction === "next") {
			const list = nextChildren.get(r.fromId) ?? [];
			list.push(r.toId);
			nextChildren.set(r.fromId, list);
		} else if (r.direction === "branch") {
			const list = branchChildren.get(r.fromId) ?? [];
			list.push(r.toId);
			branchChildren.set(r.fromId, list);
		}
	}

	// Find root
	const hasIncoming = new Set(
		train.relations
			.filter((r) => r.direction === "next" || r.direction === "branch")
			.map((r) => r.toId),
	);
	const root = train.thoughts.find((t) => !hasIncoming.has(t.id));
	if (!root) return [];

	// Main chain: follow "next" from root
	const mainChainIds: string[] = [];
	let current = root.id;
	mainChainIds.push(current);
	while (nextChildren.has(current)) {
		const nexts = nextChildren.get(current)!;
		if (nexts.length > 0) {
			current = nexts[0];
			mainChainIds.push(current);
		} else {
			break;
		}
	}

	const groups: GroupSpec[] = [];

	// Main chain group (only if 2+ nodes)
	if (mainChainIds.length >= 2) {
		groups.push({
			id: groupId("main"),
			label: "Main Chain",
			color: "3", // yellow
			memberIds: mainChainIds,
		});
	}

	// Branch groups: per branch origin, collect all descendants via next/branch DFS
	for (const r of train.relations) {
		if (r.direction !== "branch") continue;

		const branchMembers: string[] = [];
		const stack = [r.toId];
		const visited = new Set<string>();
		while (stack.length > 0) {
			const id = stack.pop()!;
			if (visited.has(id)) continue;
			visited.add(id);
			branchMembers.push(id);
			for (const nextId of nextChildren.get(id) ?? []) {
				stack.push(nextId);
			}
			for (const branchId of branchChildren.get(id) ?? []) {
				stack.push(branchId);
			}
		}

		if (branchMembers.length > 0) {
			const originTitle = train.thoughts.find((t) => t.id === r.fromId)?.title ?? r.fromId;
			groups.push({
				id: groupId(`branch-${r.fromId}`),
				label: `Branch from: ${originTitle}`,
				color: "2", // orange
				memberIds: branchMembers,
			});
		}
	}

	// Convert group specs to CanvasGroupData with bounding boxes
	return groups
		.map((spec) => {
			const memberPositions = spec.memberIds
				.map((id) => positions.get(id))
				.filter((p): p is NodePosition => p !== undefined);

			if (memberPositions.length === 0) return null;

			const minX = Math.min(...memberPositions.map((p) => p.x));
			const minY = Math.min(...memberPositions.map((p) => p.y));
			const maxX = Math.max(...memberPositions.map((p) => p.x));
			const maxY = Math.max(...memberPositions.map((p) => p.y));

			const group: CanvasGroupData = {
				id: spec.id,
				type: "group",
				label: spec.label,
				color: spec.color,
				x: minX - GROUP_PADDING,
				y: minY - GROUP_PADDING,
				width: (maxX - minX) + NODE_WIDTH + GROUP_PADDING * 2,
				height: (maxY - minY) + NODE_HEIGHT + GROUP_PADDING * 2,
			};
			return group;
		})
		.filter((g): g is CanvasGroupData => g !== null);
}

// ── Annotations ──────────────────────────────────────────────

const ANNOTATION_WIDTH = 400;
const ANNOTATION_HEIGHT = 120;
const HEADER_OFFSET_Y = 160; // how far above root the header sits

/**
 * Compute text annotations for train metadata and branch context.
 */
export function computeAnnotations(
	train: TrainState,
	positions: Map<string, NodePosition>,
): CanvasTextData[] {
	if (train.thoughts.length === 0) return [];

	const annotations: CanvasTextData[] = [];

	// Find root position
	const hasIncoming = new Set(
		train.relations
			.filter((r) => r.direction === "next" || r.direction === "branch")
			.map((r) => r.toId),
	);
	const root = train.thoughts.find((t) => !hasIncoming.has(t.id)) ?? train.thoughts[0];
	const rootPos = positions.get(root.id);

	// Header annotation: positioned above root node
	if (rootPos) {
		const durationText = train.durationMinutes > 0
			? `${train.durationMinutes} min`
			: "in progress";

		const headerText = [
			`# ${train.title}`,
			`**Status:** ${train.status}`,
			`**Thoughts:** ${train.thoughts.length} | **Duration:** ${durationText}`,
		].join("\n");

		annotations.push({
			id: annotationId("header"),
			type: "text",
			text: headerText,
			x: rootPos.x,
			y: rootPos.y - HEADER_OFFSET_Y,
			width: ANNOTATION_WIDTH,
			height: ANNOTATION_HEIGHT,
		});
	}

	// Branch annotations: positioned near each branch group
	for (const r of train.relations) {
		if (r.direction !== "branch") continue;

		// Count branch descendants
		const nextChildren = new Map<string, string[]>();
		const branchChildren = new Map<string, string[]>();
		for (const rel of train.relations) {
			if (rel.direction === "next") {
				const list = nextChildren.get(rel.fromId) ?? [];
				list.push(rel.toId);
				nextChildren.set(rel.fromId, list);
			} else if (rel.direction === "branch") {
				const list = branchChildren.get(rel.fromId) ?? [];
				list.push(rel.toId);
				branchChildren.set(rel.fromId, list);
			}
		}

		let count = 0;
		const stack = [r.toId];
		const visited = new Set<string>();
		while (stack.length > 0) {
			const id = stack.pop()!;
			if (visited.has(id)) continue;
			visited.add(id);
			count++;
			for (const nid of nextChildren.get(id) ?? []) stack.push(nid);
			for (const bid of branchChildren.get(id) ?? []) stack.push(bid);
		}

		const branchPos = positions.get(r.toId);
		if (branchPos) {
			annotations.push({
				id: annotationId(`branch-${r.fromId}`),
				type: "text",
				text: `Branch (${count} thought${count !== 1 ? "s" : ""})`,
				x: branchPos.x,
				y: branchPos.y - HEADER_OFFSET_Y,
				width: 250,
				height: 40,
			});
		}
	}

	return annotations;
}

// ── Canvas Generation ─────────────────────────────────────────

/**
 * Generate CanvasData from a train's graph state.
 * Pure function — no I/O.
 */
export function generateTrainCanvasData(train: TrainState): CanvasData {
	const positions = computeLayout(train);
	const roles = computeNodeRoles(train);

	const fileNodes: CanvasFileData[] = train.thoughts.map((t) => {
		const pos = positions.get(t.id) ?? { x: 0, y: 0 };
		const role = roles.get(t.id) ?? "normal";
		const color = ROLE_COLOR[role];

		return {
			id: nodeId(t.id),
			type: "file" as const,
			file: t.path,
			x: pos.x,
			y: pos.y,
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
			...(color ? { color } : {}),
		};
	});

	const groups = computeGroups(train, positions);
	const annotations = computeAnnotations(train, positions);

	const nodes: AllCanvasNodeData[] = [...groups, ...annotations, ...fileNodes];

	const edges = train.relations.map((r) => {
		const edge: CanvasEdgeData = {
			id: edgeId(r.fromId, r.toId),
			fromNode: nodeId(r.fromId),
			toNode: nodeId(r.toId),
			fromSide: r.direction === "branch" ? "right" : "bottom",
			toSide: "top",
			fromEnd: "none",
			toEnd: "arrow",
		};
		if (r.direction === "branch") {
			edge.label = "branch";
			edge.color = "2"; // orange
		} else if (r.direction === "merge") {
			edge.label = "merge";
			edge.color = "4"; // blue
			edge.fromSide = "right";
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
	let fileAlreadyExists = false;
	try {
		fileAlreadyExists = await fileSystem.fileExists(canvasPath);
		if (fileAlreadyExists) {
			const content = await fileSystem.readFile(canvasPath);
			existing = JSON.parse(content) as CanvasData;
		}
	} catch {
		// Invalid JSON or read error — will overwrite with fresh canvas
	}

	const merged = mergeCanvasLayers(managed, existing);
	const json = JSON.stringify(merged, null, 2);

	const action = fileAlreadyExists ? "updated" : "created";
	if (fileAlreadyExists) {
		await fileSystem.updateFile(canvasPath, json);
	} else {
		await fileSystem.createFile(canvasPath, json);
	}

	return { action, path: canvasPath };
}
