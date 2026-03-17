/**
 * Event types owned by the Event Filter domain.
 */
export interface EventFilterEventMap {
	/** Emitted when filter state is loaded from storage */
	"eventFilter.loaded": { excludedTypes: string[] };
	/** Emitted when the exclusion list changes */
	"eventFilter.changed": { excludedTypes: string[] };
	/** Command: toggle a single event type's exclusion */
	"eventFilter.toggle": { eventType: string };
	/** Command: toggle all event types in a category */
	"eventFilter.toggleCategory": { category: string };
}
