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

	/** Resume a paused train. trainId identifies which train to resume (omit for active train). */
	"ui.resumeTrain": { trainId?: string };

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

	/** Open the Journey Builder sidebar, optionally for a named journey */
	"ui.openJourneyBuilder": { name?: string };

	/** Open the Test Management Hub view (or reveal if already open) */
	"ui.openTestManagementHub": Record<string, never>;

	/** Run a journey definition from the vault */
	"ui.runJourney": {
		journeyName: string;
		jsonPath: string;
		canvasPath?: string;
	};

	/** Emitted after a view or modal was opened by UiCommandService */
	"ui.opened": {
		target: string;
		timestamp: string;
	};

	// ── Navigation events ─────────────────────────────────────

	/** Navigate to a specific tab within a hub view */
	"ui.navigateTab": {
		viewId: string;
		tabId: string;
		entityId?: string;
	};

	/** Open a vault file in the editor */
	"ui.openFile": {
		filePath: string;
	};

	// ── Session UI events ─────────────────────────────────────

	/** Open the Session Workspace view */
	"ui.openSessionWorkspace": {
		sessionId?: string;
	};

	/** Open the Session Workspace sidebar */
	"ui.openSessionWorkspaceSidebar": Record<string, never>;

	/** Create a new session */
	"ui.createSession": Record<string, never>;

	/** Resume the active paused session */
	"ui.resumeSession": Record<string, never>;

	/** A session was selected in the sessions list */
	"ui.sessionSelected": {
		sessionId: string;
	};

	// ── Installer UI events ───────────────────────────────────

	/** Open the installer view */
	"ui.openInstaller": Record<string, never>;

	// ── Train UI events ───────────────────────────────────────

	/** Pause an active train */
	"ui.pauseTrain": {
		trainId: string;
	};

	/** Delete a train */
	"ui.deleteTrain": {
		trainId: string;
	};

	// ── Inbox UI events ───────────────────────────────────────

	/** An inbox item was selected */
	"ui.inboxItemSelected": {
		itemId: string;
	};

	/** An inbox action was triggered */
	"ui.inboxAction": {
		actionId: string;
		itemId?: string;
	};

	// ── Data Exchange UI events ───────────────────────────────

	/** Import a CSV file */
	"ui.importCsv": Record<string, never>;

	/** Export as CSV */
	"ui.exportCsv": Record<string, never>;

	/** Export as tab-delimited */
	"ui.exportTab": Record<string, never>;

	/** Sync signals */
	"ui.signalSync": Record<string, never>;

	/** Import a canvas file */
	"ui.importCanvas": Record<string, never>;

	/** Run a saved import config */
	"ui.runImport": {
		configId: string;
	};

	/** Edit a saved import config */
	"ui.editImport": {
		configId: string;
	};

	/** Delete a saved import config */
	"ui.deleteImport": {
		configId: string;
	};

	/** Create a new import config */
	"ui.createImport": Record<string, never>;

	/** Run a saved export config */
	"ui.runExport": {
		configId: string;
	};

	/** Edit a saved export config */
	"ui.editExport": {
		configId: string;
	};

	/** Delete a saved export config */
	"ui.deleteExport": {
		configId: string;
	};

	/** Create a new export config */
	"ui.createExport": Record<string, never>;

	/** Select a pipeline for viewing */
	"ui.selectPipeline": {
		pipelineId: string;
	};

	/** Create a property documentation file */
	"ui.createPropertyDoc": {
		propertyName: string;
	};

	/** Sync a specific signal */
	"ui.syncSignal": {
		signalId: string;
	};

	/** Run a canvas import workflow */
	"ui.runCanvasImport": {
		canvasPath: string;
		configId?: string;
	};

	// ── Catalog UI events ─────────────────────────────────────

	/** A health item was selected in the catalog */
	"catalog.health.selected": {
		itemId: string;
	};

	/** A domain entity was selected in the catalog */
	"catalog.domains.selected": {
		entityId: string;
	};

	/** A service entity was selected in the catalog */
	"catalog.services.selected": {
		entityId: string;
	};

	/** A flow entity was selected in the catalog */
	"catalog.flows.selected": {
		entityId: string;
	};

	/** A system entity was selected in the catalog */
	"catalog.systems.selected": {
		entityId: string;
	};

	/** An actor entity was selected in the catalog */
	"catalog.actors.selected": {
		entityId: string;
	};
}
