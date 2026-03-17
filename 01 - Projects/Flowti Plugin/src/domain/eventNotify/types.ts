/**
 * Types for the Event Notify domain.
 */

/**
 * Persisted state for event notifications.
 * Stores which event types trigger an Obsidian Notice popup.
 */
export interface EventNotifyState {
	/** Event type strings that trigger notifications */
	notifiedTypes: string[];
}
