/**
 * Event definitions for the Flowti application.
 *
 * Add new events here to extend the event system.
 * Each event follows the xstate v5 convention: `{ type, payload }`.
 *
 * @example Adding a new event
 * ```typescript
 * // 1. Add the event to FlowtiEventMap
 * export interface FlowtiEventMap {
 *   "task.created": { task: Task };
 *   "task.completed": { taskId: string };
 * }
 *
 * // 2. Use it with full type safety
 * eventBus.emit("task.created", { task: newTask });
 * eventBus.on("task.completed", (event) => {
 *   console.log(event.payload.taskId); // Type-safe!
 * });
 * ```
 */

import type { LogEntry } from "../logger/types";
import type { FlowtiSettings } from "../settings/settings";
import type { FlowtiUser } from "../user/types";

/**
 * Map of all event types to their payload types.
 *
 * This is the central registry for all events in the application.
 * The key is the event type string, the value is the payload type.
 */
export interface FlowtiEventMap {
	// User events
	/** Emitted when a new user is created */
	"user.created": { user: FlowtiUser };
	/** Emitted when user data is updated */
	"user.updated": { user: FlowtiUser };

	// Settings events
	/** Emitted when settings are changed */
	"settings.changed": { settings: FlowtiSettings };

	// Log events
	/** Emitted for each log entry (useful for log aggregation) */
	"log.entry": LogEntry;
	/** Emitted when an error is logged */
	"log.error": LogEntry;
}

/**
 * All valid event type strings.
 */
export type EventType = keyof FlowtiEventMap;

/**
 * Wildcard type for listening to all events.
 */
export type WildcardType = "*";

/**
 * Event types including wildcard.
 */
export type SubscribableEventType = EventType | WildcardType;
