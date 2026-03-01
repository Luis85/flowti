/**
 * UI command events for the Flowti application.
 *
 * These events represent user-initiated actions (opening views, importing,
 * exporting) that enter the system through Obsidian commands, ribbon icons,
 * or file-menu items. The {@link UiCommandService} listens for these events
 * and performs the actual view/modal opening.
 */

import type { ExportFormat, SavedExportConfig, SavedImportConfig } from "../../domain/dataExchange/types";
import type { CaptureType } from "../../domain/capture/types";

/**
 * Map of UI command events to their payload types.
 *
 * Events follow the `ui.` prefix convention. Command events use imperative
 * names (`openCatalog`), and the completion event uses past tense (`opened`).
 */
export interface UiCommandEventMap {
	/** Open the Event Catalog view (or reveal if already open) */
	"ui.openEventCatalog": Record<string, never>;

	/** Open the Event Log view in the right sidebar */
	"ui.openEventLog": Record<string, never>;

	/** Open the Component Showcase view in the right sidebar */
	"ui.openComponentShowcase": Record<string, never>;

	/** Open the Data Exchange Hub view */
	"ui.openDataExchangeHub": Record<string, never>;

	/** Open the User Hub view */
	"ui.openUserHub": Record<string, never>;

	/** Open the Subscription Manager modal */
	"ui.openSubscriptionManager": Record<string, never>;

	/** Open the CSV import view. If filePath is absent, an InputModal prompts the user. */
	"ui.openCsvImport": {
		filePath?: string;
		savedConfig?: SavedImportConfig;
		autoStart?: boolean;
	};

	/** Open the export view. If sourcePath is absent, an InputModal prompts the user. */
	"ui.openExport": {
		sourcePath?: string;
		sourceType?: "folder" | "base";
		format: ExportFormat;
		savedConfig?: SavedExportConfig;
	};

	/** Open the Quick Capture modal */
	"ui.openQuickCapture": { type?: CaptureType; title?: string };

	/** Capture an idea directly from the User Hub dashboard (no modal) */
	"ui.captureIdea": { title: string };

	/** Start a Train of Thoughts serial capture session */
	"ui.startTrain": { fromThoughtId?: string; fromFilePath?: string; mergeDown?: boolean };

	/** Open the Train Main View (or reveal if already open). Optional trainId targets a specific train. */
	"ui.openTrainView": { trainId?: string };

	/** Toggle the Train Timeline Sidebar (show/hide). forceClose=true always collapses. */
	"ui.toggleTrainTimeline": { trainId: string; forceClose?: boolean };

	/** Resume the active paused train (command palette) */
	"ui.resumeTrain": Record<string, never>;

	/** Complete the active running/paused train (command palette) */
	"ui.completeTrain": Record<string, never>;

	/** Open the canvas for the active train (command palette) */
	"ui.openTrainCanvas": Record<string, never>;

	/** Open the train timeline sidebar for the active train (command palette) */
	"ui.openTrainTimeline": Record<string, never>;

	/** Open the Train Hub view (or reveal if already open) */
	"ui.openTrainHub": Record<string, never>;

	/** Start a guided canvas session (opens template picker → canvas + sidebar) */
	"ui.startCanvasSession": Record<string, never>;

	/** Open the Analytics Hub view (or reveal if already open) */
	"ui.openAnalyticsHub": Record<string, never>;

	/** Emitted after a view or modal was opened by UiCommandService */
	"ui.opened": {
		target: string;
		timestamp: string;
	};
}
