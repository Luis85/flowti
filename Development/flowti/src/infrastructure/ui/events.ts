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
	"ui.openQuickCapture": { type?: CaptureType };

	/** Start a Train of Thoughts serial capture session */
	"ui.startTrain": { fromThoughtId?: string };

	/** Open the Train Main View (or reveal if already open) */
	"ui.openTrainView": Record<string, never>;

	/** Toggle the Train Timeline Sidebar (show/hide) */
	"ui.toggleTrainTimeline": { trainId: string };

	/** Emitted after a view or modal was opened by UiCommandService */
	"ui.opened": {
		target: string;
		timestamp: string;
	};
}
