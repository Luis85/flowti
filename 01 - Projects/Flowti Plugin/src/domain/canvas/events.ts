/**
 * Event map for the Canvas Integration domain.
 *
 * Events follow the `canvas.` prefix convention.
 */

import type { CanvasImportResult, CanvasItem } from "./types";

export interface CanvasEventMap {
	/** Emitted when a canvas import starts. */
	"canvas.import.started": { canvasPath: string; targetFolder: string; totalNodes: number };
	/** Emitted per-node during import for progress tracking. */
	"canvas.import.progress": { canvasPath: string; current: number; total: number; title: string };
	/** Emitted when a canvas import completes successfully. */
	"canvas.import.completed": { result: CanvasImportResult };
	/** Emitted when a canvas import fails. */
	"canvas.import.failed": { canvasPath: string; error: string };
	/** Emitted when a canvas node is resolved to a Flowti entity. */
	"canvas.entity.detected": { item: CanvasItem; targetPath: string };
	/** Emitted when a Legend group is found with color-to-type mappings. */
	"canvas.legend.detected": { canvasPath: string; mappings: Record<string, string> };
	/** Emitted when an import configuration is saved. */
	"canvas.config.saved": { configId: string; name: string };
	/** Emitted when canvas state is loaded from storage. */
	"canvas.loaded": { configCount: number };
	/** Emitted when a canvas is created from a template. */
	"canvas.template.created": { templateId: string; templateName: string; canvasPath: string };
	/** Emitted when a canvas session monitor starts tracking. */
	"canvas.session.started": { sessionId: string; canvasPath: string; goal: string };
	/** Emitted when a canvas session's node stats change. */
	"canvas.session.activity": { sessionId: string; action: string; detail: string };
	/** Emitted when a canvas session completes. */
	"canvas.session.completed": { sessionId: string; canvasPath: string; nodesAdded: number; edgesAdded: number };
}
