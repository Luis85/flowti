/**
 * Types for the Inbox domain.
 *
 * Defines the InboxItem entity, persisted state shape,
 * and the maximum capacity for the inbox buffer.
 */

// ─────────────────────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────────────────────

/** A single actionable or informational item in the user's inbox. */
export interface InboxItem {
	id: string;
	/** "action" = requires user attention; "info" = informational */
	type: "action" | "info";
	title: string;
	description: string;
	/** The event type that created this item (e.g. "subscription.matched") */
	sourceEvent: string;
	/** Which hub/domain produced this item (e.g. "subscription", "data-exchange") */
	sourceHub: string;
	timestamp: string;
	read: boolean;
}

// ─────────────────────────────────────────────────────────────
// Persisted state
// ─────────────────────────────────────────────────────────────

/** Shape of the inbox state persisted via TypedStorage. */
export interface InboxState {
	items: InboxItem[];
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Maximum number of inbox items before oldest-first eviction. */
export const MAX_INBOX_ITEMS = 500;

/** Human-readable labels and descriptions for each inbox source event type. */
export const INBOX_SOURCE_DEFINITIONS: ReadonlyArray<{ event: string; label: string; desc: string }> = [
	{ event: "subscription.matched", label: "Watcher matches", desc: "When a file watcher subscription matches an event" },
	{ event: "dataExchange.import.completed", label: "Import completed", desc: "When a CSV import finishes successfully" },
	{ event: "dataExchange.import.failed", label: "Import errors", desc: "When a CSV import fails" },
	{ event: "dataExchange.export.completed", label: "Export completed", desc: "When a data export finishes successfully" },
	{ event: "dataExchange.pipeline.completed", label: "Pipeline completed", desc: "When a multi-import pipeline finishes successfully" },
	{ event: "dataExchange.pipeline.failed", label: "Pipeline errors", desc: "When a multi-import pipeline fails" },
	{ event: "inbox.vaultFolder.noteDetected", label: "Vault folder notes", desc: "When an untyped note appears in a watched vault folder" },
];
