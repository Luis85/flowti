/**
 * canvas-sitemap-import.ts — Pure domain: parse Obsidian canvas → v2 sitemap.
 *
 * Converts canvas nodes to PageObjects using color/shape mapping.
 * Groups become containers. Edges become navigate actions.
 * Supports additive merge with existing sitemaps.
 */

import type { UnifiedSitemap, PageObject, PageAction } from "../sitemap/unified-page.js";
import type { CanvasData, CanvasNode, CanvasImportResult } from "./canvas-sitemap-types.js";
import { COLOR_TO_KIND, SHAPE_TO_KIND, DEFAULT_KIND, GROUP_KIND } from "./canvas-sitemap-types.js";

function toKebab(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-+|-+$/g, "");
}

function nodeLabel(node: CanvasNode): string {
	return (node.type === "group" ? node.label : node.text) ?? node.id;
}

function nodeKind(node: CanvasNode): PageObject["kind"] {
	if (node.type === "group") return GROUP_KIND;
	if (node.shape && SHAPE_TO_KIND[node.shape]) return SHAPE_TO_KIND[node.shape];
	if (node.color && COLOR_TO_KIND[node.color]) return COLOR_TO_KIND[node.color];
	return DEFAULT_KIND;
}

function isInside(node: CanvasNode, grp: CanvasNode): boolean {
	return (
		node.x >= grp.x &&
		node.y >= grp.y &&
		node.x + node.width <= grp.x + grp.width &&
		node.y + node.height <= grp.y + grp.height
	);
}

const CANVAS_FIELDS = new Set(["kind", "label", "description", "parent"]);

export function parseCanvasToSitemap(
	canvas: CanvasData,
	existingSitemap?: UnifiedSitemap,
): { sitemap: UnifiedSitemap } & CanvasImportResult {
	const groups = canvas.nodes.filter((n) => n.type === "group");
	const nonGroups = canvas.nodes.filter((n) => n.type !== "group");

	const idMap = new Map<string, string>();
	for (const node of canvas.nodes) {
		idMap.set(node.id, toKebab(nodeLabel(node)));
	}

	const canvasPages: Record<string, PageObject> = {};

	for (const grp of groups) {
		const pageId = idMap.get(grp.id)!;
		canvasPages[pageId] = {
			kind: nodeKind(grp),
			label: nodeLabel(grp),
			description: "",
			actions: [],
		};
	}

	for (const node of nonGroups) {
		const pageId = idMap.get(node.id)!;
		const parent = groups.find((g) => isInside(node, g));
		canvasPages[pageId] = {
			kind: nodeKind(node),
			label: nodeLabel(node),
			description: "",
			actions: [],
			...(parent ? { parent: idMap.get(parent.id) } : {}),
		};
	}

	for (const e of canvas.edges) {
		const fromId = idMap.get(e.fromNode);
		const toId = idMap.get(e.toNode);
		if (!fromId || !toId || !canvasPages[fromId]) continue;

		const action: PageAction = {
			name: `onNavigateTo${toId.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}`,
			label: canvasPages[toId]?.label ?? toId,
			type: "navigate",
			target: toId,
		};

		const existing = canvasPages[fromId];
		canvasPages[fromId] = { ...existing, actions: [...existing.actions, action] };
	}

	let added = 0;
	let updated = 0;
	const mergedPages: Record<string, PageObject> = {};

	if (existingSitemap) {
		for (const [id, page] of Object.entries(existingSitemap.pages)) {
			mergedPages[id] = page;
		}
		for (const [id, canvasPage] of Object.entries(canvasPages)) {
			if (mergedPages[id]) {
				const existingPage = mergedPages[id];
				const preserved: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(existingPage)) {
					if (!CANVAS_FIELDS.has(key)) {
						preserved[key] = value;
					}
				}
				mergedPages[id] = { ...canvasPage, ...preserved } as PageObject;
				updated++;
			} else {
				mergedPages[id] = canvasPage;
				added++;
			}
		}
	} else {
		for (const [id, page] of Object.entries(canvasPages)) {
			mergedPages[id] = page;
			added++;
		}
	}

	return {
		sitemap: { version: 2, pages: mergedPages },
		added,
		updated,
		totalPages: Object.keys(mergedPages).length,
	};
}
