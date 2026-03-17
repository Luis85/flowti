/**
 * Types for the Event Filter domain.
 */

/**
 * Persisted state for event filtering.
 * Stores which event types are excluded from the Event Log.
 */
export interface EventFilterState {
	/** Event type strings excluded from the Event Log */
	excludedTypes: string[];
}
