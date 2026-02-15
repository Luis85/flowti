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
