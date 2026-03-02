/**
 * Event definitions for the Journey Builder domain.
 */

/** Payload for the export event — carries the full journey definition. */
export interface JourneyExportPayload {
	path: string;
	definition: {
		journey: string;
		description: string;
		startEvent: string;
		endEvent: string;
		steps: { id: string; title: string; guideSection: number }[];
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
	/** Journey was exported to JSON + test file */
	"journey-builder.exported": JourneyExportPayload;
}
