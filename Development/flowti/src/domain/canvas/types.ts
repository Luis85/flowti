/**
 * Types for the Canvas Integration domain.
 *
 * Migrates the QuickAdd canvas-import scripts into typed domain types.
 * A canvas is parsed into CanvasItems with directional relations,
 * then imported as vault notes via CanvasService.
 */

import type { CanvasData } from "obsidian/canvas";

// ─────────────────────────────────────────────────────────────
// Type mappings — how canvas nodes map to Flowti entity types
// ─────────────────────────────────────────────────────────────

/** Flowti entity type resolved from canvas node properties. Open string — user-defined legend types are arbitrary. */
export type FlowtiCanvasType = string;

/** Direction of a relationship derived from edge connection sides. */
export type CanvasRelationDirection = "up" | "down" | "prev" | "next";

/** Original Obsidian canvas node type. */
export type CanvasOriginalType = "group" | "text" | "file" | "link";

// ─────────────────────────────────────────────────────────────
// CanvasItem — a parsed node ready for import
// ─────────────────────────────────────────────────────────────

/** A parsed canvas item ready for import. */
export interface CanvasItem {
	id: string;
	title: string;
	type: FlowtiCanvasType;
	originalType: CanvasOriginalType;
	status: string;
	color: string | null;
	/** Obsidian canvas shape (undocumented but present in JSON: circle, diamond, etc.). */
	shape: string | null;
	parentId: string | null;
	/** Slugified parent group title. */
	parent: string | null;
	isEmpty: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	/** IDs of items connected above (edge toSide=top or fromSide=top). */
	up: string[];
	/** IDs of items connected below. */
	down: string[];
	/** IDs of items connected to the left. */
	prev: string[];
	/** IDs of items connected to the right. */
	next: string[];
}

// ─────────────────────────────────────────────────────────────
// Relations — edge-derived directional links
// ─────────────────────────────────────────────────────────────

/** Edge-derived relationship between two canvas items. */
export interface CanvasRelation {
	fromId: string;
	toId: string;
	direction: CanvasRelationDirection;
	label?: string;
}

// ─────────────────────────────────────────────────────────────
// Parsing result
// ─────────────────────────────────────────────────────────────

/** Result of parsing a canvas file. */
export interface CanvasParsedResult {
	items: CanvasItem[];
	relations: CanvasRelation[];
	groups: CanvasItem[];
	legendMap: Record<string, FlowtiCanvasType> | null;
	nodeCount: number;
	edgeCount: number;
}

// ─────────────────────────────────────────────────────────────
// Import configuration & result
// ─────────────────────────────────────────────────────────────

/** User-configurable import settings (saved for repeatable imports). */
export interface CanvasImportConfig {
	id: string;
	name: string;
	canvasPath: string;
	targetFolder: string;
	colorMap: Record<string, FlowtiCanvasType>;
	shapeMap: Record<string, FlowtiCanvasType>;
	conflictStrategy: "skip" | "update" | "overwrite";
	hierarchyMode: "flat" | "product";
	createdAt: string;
	lastUsed: string | null;
}

/** Result of an import operation. */
export interface CanvasImportResult {
	canvasPath: string;
	targetFolder: string;
	totalNodes: number;
	imported: number;
	skipped: number;
	errors: CanvasImportError[];
	duration: number;
	/** Map of original canvas node ID → created vault note path (for rebuilder). */
	importedPaths: Record<string, string>;
}

/** Error for a single node during import. */
export interface CanvasImportError {
	nodeId: string;
	title: string;
	error: string;
}

// ─────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────

/** Shape of persisted data via TypedStorage. */
export interface CanvasState {
	configs: CanvasImportConfig[];
}

// ─────────────────────────────────────────────────────────────
// Constants — default mappings ported from canvas-import-constants.js
// ─────────────────────────────────────────────────────────────

/** Default Obsidian canvas color → Flowti type mapping. */
export const DEFAULT_COLOR_MAP: Record<string, FlowtiCanvasType> = {
	"1": "Issue",       // red
	"2": "Epic",        // orange
	"3": "Task",        // yellow
	"4": "Test",        // green
	"5": "Deliverable", // blue
	"6": "Feature",     // purple
};

/** Default Obsidian canvas shape → Flowti type mapping. */
export const DEFAULT_SHAPE_MAP: Record<string, FlowtiCanvasType> = {
	"circle": "Event",
	"diamond": "Gateway",
	"parallelogram": "Data",
	"document": "Document",
	"database": "Database",
	"predefined-process": "Subprocess",
	"pill": "Terminator",
};

/** Type sort order for organized output (flowchart types first, then product types). */
export const TYPE_ORDER: Record<string, number> = {
	Event: 1, Gateway: 2, Subprocess: 3, Data: 4, Document: 5, Database: 6, Terminator: 7,
	Epic: 10, Feature: 11, Deliverable: 12, Task: 13, Test: 14, Issue: 15, Done: 16, Note: 17,
	Group: 50, Node: 99,
};

/** Type → subfolder name mapping for "product" hierarchy mode. */
export const TYPE_FOLDER_MAP: Record<string, string> = {
	Epic: "Epics",
	Feature: "Features",
	Task: "Tasks",
	Test: "Tests",
	Issue: "Issues",
	Event: "Events",
	Gateway: "Gateways",
	Database: "Databases",
	Data: "Data",
	Document: "Documents",
	Subprocess: "Subprocesses",
	Deliverable: "Deliverables",
};

/** Maximum number of saved import configurations. */
export const MAX_CANVAS_CONFIGS = 50;

// Re-export the Obsidian canvas data type for convenience
export type { CanvasData };
