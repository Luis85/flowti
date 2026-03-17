/**
 * Event types owned by the Event Notify domain.
 */
export interface EventNotifyEventMap {
	/** Emitted when notify state is loaded from storage */
	"eventNotify.loaded": { notifiedTypes: string[] };
	/** Emitted when the notification list changes */
	"eventNotify.changed": { notifiedTypes: string[] };
	/** Command: toggle a single event type's notification */
	"eventNotify.toggle": { eventType: string };
	/** Emitted when a notified event fires (consumed by main.ts to show Notice) */
	"eventNotify.fired": { eventType: string; timestamp: string };
}
