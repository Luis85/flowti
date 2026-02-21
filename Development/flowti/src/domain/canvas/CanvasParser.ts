/**
 * Canvas parser — pure functions for parsing Obsidian canvas JSON.
 *
 * Ported from QuickAdd canvas-import-core.js + canvas-import-constants.js.
 * No side effects, no Obsidian runtime dependencies — only type imports.
 *
 * Functions:
 *   parseCanvasJson()     — parse raw JSON string to CanvasData
 *   extractLegend()       — detect Legend group and build color→type mapping
 *   resolveNodeType()     — resolve a canvas node to a Flowti entity type
 *   slugifyTitle()        — sanitize a node title for use as file name
 *   toPascalCase()        — convert string to PascalCase
 *   isNodeInsideGroup()   — bounding-box spatial containment check
 *   resolveParentage()    — find smallest enclosing group for a node
 *   buildRelations()      — map edges to directional relations (up/down/prev/next)
 *   filterItemsForImport()— exclude legend, file, and empty nodes
 */

import type { AllCanvasNodeData, CanvasGroupData, CanvasTextData } from "obsidian/canvas";
import type { CanvasData, CanvasItem, CanvasRelation, CanvasRelationDirection, FlowtiCanvasType } from "./types";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP } from "./types";

/**
 * Parse a raw JSON string into a CanvasData object.
 * Returns null for invalid, malformed, or missing-nodes input.
 */
export function parseCanvasJson(json: string): CanvasData | null {
	if (!json || !json.trim()) return null;
	try {
		const data = JSON.parse(json) as Record<string, unknown>;
		if (!data || typeof data !== "object") return null;
		if (!Array.isArray(data.nodes)) return null;
		if (!Array.isArray(data.edges)) {
			// edges are optional — default to empty array
			data.edges = [];
		}
		return data as unknown as CanvasData;
	} catch {
		return null;
	}
}

/**
 * Detect a "Legend" group in the canvas and extract color→type mappings.
 *
 * A Legend group is a group node with label matching "legend" (case-insensitive).
 * Text nodes spatially inside it with a color become mappings: color → PascalCase(text).
 *
 * Returns null if no Legend group exists or no mappings were found.
 */
export function extractLegend(data: CanvasData): Record<string, FlowtiCanvasType> | null {
	const legendGroup = data.nodes.find(
		(n): n is CanvasGroupData => n.type === "group" && !!n.label && n.label.toLowerCase() === "legend",
	);
	if (!legendGroup) return null;

	const mappings: Record<string, FlowtiCanvasType> = {};

	for (const node of data.nodes) {
		if (node.type !== "text") continue;
		const textNode = node as CanvasTextData;
		if (!textNode.color) continue;
		if (!isNodeInsideGroup(textNode, legendGroup)) continue;

		const typeName = toPascalCase(textNode.text);
		if (typeName) {
			mappings[textNode.color] = typeName;
		}
	}

	return Object.keys(mappings).length > 0 ? mappings : null;
}

/**
 * Resolve a canvas node to a Flowti entity type.
 *
 * Resolution priority (waterfall):
 *   1. Group without color → "Group"
 *   2. Legend color mapping (if present)
 *   3. Shape mapping
 *   4. Default color mapping
 *   5. Fallback → "Node"
 */
export function resolveNodeType(
	node: AllCanvasNodeData,
	legendMap: Record<string, FlowtiCanvasType> | null,
	colorMap: Record<string, FlowtiCanvasType> = DEFAULT_COLOR_MAP,
	shapeMap: Record<string, FlowtiCanvasType> = DEFAULT_SHAPE_MAP,
): FlowtiCanvasType {
	// 1. Groups without color are containers
	if (node.type === "group" && !node.color) return "Group";

	// 2. Legend mapping takes priority
	if (legendMap && node.color && legendMap[node.color]) {
		return legendMap[node.color];
	}

	// 3. Shape mapping (undocumented `shape` property on canvas nodes)
	const shape = (node as Record<string, unknown>).shape as string | undefined;
	if (shape && shapeMap[shape]) {
		return shapeMap[shape];
	}

	// 4. Default color mapping
	if (node.color && colorMap[node.color]) {
		return colorMap[node.color];
	}

	// 5. Fallback
	return "Node";
}

/**
 * Slugify a title for use as a file name.
 *
 * - Strips leading `#` characters (markdown headers in text nodes)
 * - Removes file-system invalid characters
 * - Collapses whitespace
 * - Truncates on word boundary
 * - Returns "untitled" for empty results
 */
export function slugifyTitle(title: string, maxLength = 80): string {
	if (!title) return "untitled";

	let slug = title
		.replace(/^#+\s*/, "")          // strip leading # (markdown headers)
		.replace(/[\\/:*?"<>|]/g, "")   // remove invalid file chars
		.replace(/\s+/g, " ")           // collapse whitespace
		.trim();

	if (!slug) return "untitled";

	if (slug.length > maxLength) {
		// Truncate on word boundary
		const truncated = slug.slice(0, maxLength);
		const lastSpace = truncated.lastIndexOf(" ");
		slug = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
		slug = slug.trim();
	}

	return slug || "untitled";
}

/**
 * Convert a string to PascalCase.
 * Splits on whitespace, underscores, and hyphens.
 */
export function toPascalCase(str: string): string {
	if (!str) return "";
	return str
		.trim()
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

/**
 * Check whether a node is spatially contained inside a group.
 * Uses bounding-box containment: node must be fully within group bounds.
 */
export function isNodeInsideGroup(
	node: { x: number; y: number; width: number; height: number },
	group: { x: number; y: number; width: number; height: number },
): boolean {
	const gx1 = group.x;
	const gy1 = group.y;
	const gx2 = group.x + group.width;
	const gy2 = group.y + group.height;

	const nx = node.x;
	const ny = node.y;

	return nx >= gx1 && nx <= gx2 && ny >= gy1 && ny <= gy2;
}

// ─────────────────────────────────────────────────────────────
// Inc 2 — Parentage, Relations, Filtering
// ─────────────────────────────────────────────────────────────

/**
 * Find the smallest enclosing group for a node.
 *
 * Iterates all groups, checks bounding-box containment, and picks
 * the group with the smallest area. Prevents self-parentage.
 *
 * Returns { parentId, parent (slugified label) } or null if no enclosing group.
 */
export function resolveParentage(
	node: { id: string; x: number; y: number; width: number; height: number },
	groups: ReadonlyArray<{ id: string; x: number; y: number; width: number; height: number; label?: string }>,
): { parentId: string; parent: string | null } | null {
	let bestId: string | null = null;
	let bestArea = Infinity;
	let bestLabel = "";

	for (const group of groups) {
		// Never self-parent
		if (group.id === node.id) continue;

		// Must be spatially inside
		if (!isNodeInsideGroup(node, group)) continue;

		const area = group.width * group.height;

		// Smallest enclosing group wins (for nested groups)
		if (area > 0 && area < bestArea) {
			bestArea = area;
			bestId = group.id;
			bestLabel = group.label ?? "";
		}
	}

	if (!bestId) return null;

	return {
		parentId: bestId,
		parent: bestLabel ? slugifyTitle(bestLabel) : null,
	};
}

/** Map a canvas edge side to a CanvasRelationDirection. */
function sideToDirection(side: string): CanvasRelationDirection | null {
	switch (side) {
		case "top": return "up";
		case "bottom": return "down";
		case "left": return "prev";
		case "right": return "next";
		default: return null;
	}
}

/**
 * Map canvas edges to directional relations on items.
 *
 * For each edge, maps fromSide/toSide to up/down/prev/next and populates
 * both the from-item and to-item arrays (bidirectional). Self-edges and
 * duplicates are removed after processing.
 *
 * Returns a CanvasRelation[] array (one per edge, from the fromSide perspective).
 */
export function buildRelations(
	items: CanvasItem[],
	edges: CanvasData["edges"],
): CanvasRelation[] {
	const itemById = new Map(items.map(i => [i.id, i]));
	const relations: CanvasRelation[] = [];

	for (const edge of edges) {
		const fromItem = itemById.get(edge.fromNode);
		const toItem = itemById.get(edge.toNode);

		// From side → direction on fromItem
		if (fromItem && edge.fromSide) {
			const dir = sideToDirection(edge.fromSide);
			if (dir) {
				fromItem[dir].push(edge.toNode);
				relations.push({
					fromId: edge.fromNode,
					toId: edge.toNode,
					direction: dir,
					label: edge.label,
				});
			}
		}

		// To side → direction on toItem (bidirectional)
		if (toItem && edge.toSide) {
			const dir = sideToDirection(edge.toSide);
			if (dir) {
				toItem[dir].push(edge.fromNode);
			}
		}
	}

	// Deduplicate and remove self-edges
	for (const item of items) {
		const dedup = (arr: string[]): string[] =>
			[...new Set(arr)].filter(id => id !== item.id);
		item.up = dedup(item.up);
		item.down = dedup(item.down);
		item.prev = dedup(item.prev);
		item.next = dedup(item.next);
	}

	return relations;
}

/** Options for filtering canvas items before import. */
export interface CanvasFilterOptions {
	/** Skip nodes with no text/label content. Default: true. */
	skipEmpty?: boolean;
	/** Legend group bounds — the group itself + text nodes inside are excluded. */
	legendGroup?: { id: string; x: number; y: number; width: number; height: number } | null;
}

/**
 * Filter canvas items for import.
 *
 * Excludes:
 *  - File nodes (already existing vault files — not importable)
 *  - Legend group node itself
 *  - Text nodes spatially inside the legend group
 *  - Empty nodes (when skipEmpty is true, default)
 */
export function filterItemsForImport(
	items: CanvasItem[],
	options: CanvasFilterOptions = {},
): CanvasItem[] {
	const { skipEmpty = true, legendGroup = null } = options;

	return items.filter(item => {
		// File nodes are already vault files — skip
		if (item.originalType === "file") return false;

		if (legendGroup) {
			// Legend group itself
			if (item.id === legendGroup.id) return false;
			// Text nodes inside the legend group (color swatches)
			if (item.originalType === "text" && isNodeInsideGroup(item, legendGroup)) return false;
		}

		// Optionally skip empty nodes (no text/label)
		if (skipEmpty && item.isEmpty) return false;

		return true;
	});
}
