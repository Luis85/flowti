/**
 * Event definitions for the Journey Builder domain.
 */
import type { CanvasSyncInput } from "./canvasSync";

/** Payload for the export event — carries the full journey definition. */
export interface JourneyExportPayload {
	path: string;
	testFilePath?: string;
	canvasPath?: string;
	definition: {
		journey: string;
		description: string;
		startEvent: string;
		endEvent: string;
		steps: {
			id: string;
			title: string;
			description: string;
			swimlane: string;
			guideSection: number;
			actions?: Array<{ tool: string; [key: string]: unknown }>;
		}[];
	};
}

export interface JourneyBuilderEventMap {
	/** Journey Builder sidebar was opened */
	"journey-builder.opened": Record<string, never>;
	/** User clicked "Create New Journey" */
	"journey-builder.create-new": Record<string, never>;
	/** User clicked "Open Existing Journey" */
	"journey-builder.open-existing": Record<string, never>;
	/** Journey metadata was updated (name, chapter, description, start/end event) */
	"journey-builder.metadata.updated": { field: string; value: string };
	/** A step was added to the journey */
	"journey-builder.step.added": { stepId: string; title: string };
	/** A step was updated (title, description, chip arrays, etc.) */
	"journey-builder.step.updated": { stepId: string; field: string; value: string | string[] };
	/** An action was added to a step */
	"journey-builder.action.added": { stepId: string; tool: string };
	/** Journey was exported to JSON + test file */
	"journey-builder.exported": JourneyExportPayload;
	/** Canvas sync was requested (carries current definition + target path) */
	"journey-builder.canvas.sync-requested": {
		canvasPath: string;
		definition: CanvasSyncInput;
	};
	/** Companion canvas file was written/updated */
	"journey-builder.canvas.synced": {
		canvasPath: string;
	};
	/** User selected a journey file to import */
	"journey-builder.import-requested": {
		path: string;
	};
	/** Journey JSON was read and is ready for hydration */
	"journey-builder.imported": {
		json: string;
	};
}
