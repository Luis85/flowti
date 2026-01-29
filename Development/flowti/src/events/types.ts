import type { EventType, FlowtiEventMap } from "./events";

export type { EventType, FlowtiEventMap } from "./events";

// Re-export file system types from events.ts
export type {
	RequestId,
	FileChangeSource,
	FileRequestBase,
	FileResponseBase,
	FileOperationError,
} from "./events";

/**
 * Base event interface compatible with xstate v5.
 * All events have a type, payload, and timestamp.
 */
export interface FlowtiEvent<
	T extends EventType = EventType,
	P = FlowtiEventMap[T],
> {
	readonly type: T;
	readonly payload: P;
	readonly timestamp: string;
}

/**
 * Union type of all Flowti events.
 */
export type FlowtiEvents = {
	[K in EventType]: FlowtiEvent<K, FlowtiEventMap[K]>;
}[EventType];

/**
 * Extracts the payload type for a specific event type.
 */
export type EventPayload<T extends EventType> = FlowtiEventMap[T];

/**
 * Event handler function type for specific event types.
 */
export type EventHandler<T extends EventType = EventType> = (
	event: FlowtiEvent<T, FlowtiEventMap[T]>
) => void | Promise<void>;

/**
 * Wildcard event handler that receives any event.
 */
export type WildcardEventHandler = (event: FlowtiEvents) => void | Promise<void>;

/**
 * Interface for the event bus service.
 */
export interface IEventBus {
	/**
	 * Emits an event to all registered handlers.
	 * @param type - The event type
	 * @param payload - The event payload
	 */
	emit<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void>;

	/**
	 * Registers an event handler for a specific event type.
	 * @param type - The event type to listen for
	 * @param handler - The handler function
	 * @returns Unsubscribe function
	 */
	on<T extends EventType>(type: T, handler: EventHandler<T>): () => void;

	/**
	 * Registers a wildcard handler that receives all events.
	 * @param type - The wildcard "*"
	 * @param handler - The handler function
	 * @returns Unsubscribe function
	 */
	on(type: "*", handler: WildcardEventHandler): () => void;

	/**
	 * Registers a one-time event handler that auto-unsubscribes after first call.
	 * @param type - The event type to listen for
	 * @param handler - The handler function
	 * @returns Unsubscribe function
	 */
	once<T extends EventType>(type: T, handler: EventHandler<T>): () => void;

	/**
	 * Removes an event handler.
	 * @param type - The event type
	 * @param handler - The handler to remove
	 */
	off<T extends EventType>(type: T, handler: EventHandler<T>): void;

	/**
	 * Removes a wildcard handler.
	 * @param type - The wildcard "*"
	 * @param handler - The handler to remove
	 */
	off(type: "*", handler: WildcardEventHandler): void;

	/**
	 * Removes all event handlers.
	 */
	clear(): void;
}
