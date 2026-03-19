/**
 * canvas-sitemap-types.ts — Types for canvas-to-sitemap import.
 */

import type { PageKind } from "../sitemap/unified-page.js";

export interface CanvasNode {
	readonly id: string;
	readonly type: "text" | "group" | "file" | "link";
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text?: string;
	readonly label?: string;
	readonly color?: string;
	readonly shape?: string;
}

export interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly fromSide?: string;
	readonly toSide?: string;
	readonly label?: string;
}

export interface CanvasData {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly CanvasEdge[];
}

export interface CanvasImportResult {
	readonly added: number;
	readonly updated: number;
	readonly totalPages: number;
}

/** Color (1-6) → PageKind mapping */
export const COLOR_TO_KIND: Record<string, PageKind> = {
	"1": "dialog",
	"2": "form",
	"3": "list",
	"4": "page",
	"5": "layout",
	"6": "system",
};

/** Shape → PageKind mapping */
export const SHAPE_TO_KIND: Record<string, PageKind> = {
	"diamond": "ui-component",
	"circle": "person",
	"document": "c4-component",
};

/** Default kind when no color or shape is set */
export const DEFAULT_KIND: PageKind = "component";

/** Group nodes always become containers */
export const GROUP_KIND: PageKind = "container";
