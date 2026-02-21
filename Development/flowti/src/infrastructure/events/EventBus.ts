import type {
	EventHandler,
	EventPayload,
	EventType,
	FlowtiEvent,
	FlowtiEvents,
	IEventBus,
	WildcardEventHandler,
} from "./types";

/** Internal key for wildcard handlers */
const WILDCARD = "*" as const;

/** Handler type stored internally */
type StoredHandler = EventHandler | WildcardEventHandler;

/**
 * Event bus for decoupled communication between components.
 *
 * Implements a publish-subscribe pattern with full TypeScript type safety.
 * Events follow the xstate v5 convention with `{ type, payload, timestamp }` structure,
 * enabling seamless future integration with xstate state machines.
 *
 * @remarks
 * The EventBus provides loose coupling between components by allowing them to
 * communicate through events rather than direct method calls. This pattern is
 * particularly useful for:
 * - Cross-service communication without circular dependencies
 * - UI updates in response to state changes
 * - Plugin extensibility through event hooks
 *
 * @example Basic subscription and emission
 * ```typescript
 * const eventBus = new EventBus();
 *
 * // Subscribe to an event
 * eventBus.on("user.created", (event) => {
 *   console.log(`User created: ${event.payload.user.name}`);
 *   console.log(`Timestamp: ${event.timestamp}`);
 * });
 *
 * // Emit an event
 * await eventBus.emit("user.created", { user: newUser });
 * ```
 *
 * @example Using the unsubscribe function
 * ```typescript
 * const unsubscribe = eventBus.on("settings.changed", (event) => {
 *   applySettings(event.payload.settings);
 * });
 *
 * // Later, when cleanup is needed:
 * unsubscribe();
 * ```
 *
 * @example Wildcard listener for debugging
 * ```typescript
 * // Listen to ALL events
 * eventBus.on("*", (event) => {
 *   console.log(`[${event.timestamp}] ${event.type}`, event.payload);
 * });
 * ```
 *
 * @example One-time event handler
 * ```typescript
 * // Handler automatically unsubscribes after first call
 * eventBus.once("user.created", (event) => {
 *   showWelcomeMessage(event.payload.user);
 * });
 * ```
 *
 * @example Plugin lifecycle integration
 * ```typescript
 * class MyPlugin extends Plugin {
 *   eventBus: IEventBus;
 *
 *   async onload() {
 *     this.eventBus = new EventBus();
 *     // ... register handlers
 *   }
 *
 *   async onunload() {
 *     this.eventBus.clear(); // Remove all handlers on plugin unload
 *   }
 * }
 * ```
 *
 * @see {@link IEventBus} for the interface definition
 * @see {@link FlowtiEvents} for available event types
 */
export class EventBus implements IEventBus {
	private handlers: Map<EventType | typeof WILDCARD, Set<StoredHandler>>;
	private onError?: (error: unknown, eventType: string) => void;

	constructor(options?: { onError?: (error: unknown, eventType: string) => void }) {
		this.handlers = new Map();
		this.onError = options?.onError;
	}

	/**
	 * Emits an event to all registered handlers.
	 *
	 * Handlers are called sequentially in registration order. If a handler is async,
	 * the next handler waits for it to complete before executing.
	 * Wildcard handlers are called after type-specific handlers.
	 *
	 * @typeParam T - The event type, inferred from the `type` parameter
	 * @param type - The event type string (e.g., "user.created")
	 * @param payload - The event payload, type-checked against the event definition
	 * @returns A promise that resolves when all handlers have completed
	 *
	 * @example
	 * ```typescript
	 * await eventBus.emit("user.created", {
	 *   user: { id: "123", name: "John", createdAt: "2024-01-01T00:00:00Z" }
	 * });
	 * ```
	 */
	async emit<T extends EventType>(
		type: T,
		payload: EventPayload<T>
	): Promise<void> {
		const event: FlowtiEvent<T> = {
			type,
			payload,
			timestamp: new Date().toISOString(),
		};

		// Call type-specific handlers
		const typeHandlers = this.handlers.get(type);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				try {
					await (handler as EventHandler<T>)(event);
				} catch (err) {
					this.routeError(err, type);
				}
			}
		}

		// Call wildcard handlers
		const wildcardHandlers = this.handlers.get(WILDCARD);
		if (wildcardHandlers) {
			for (const handler of wildcardHandlers) {
				try {
					await (handler as WildcardEventHandler)(event as FlowtiEvents);
				} catch (err) {
					this.routeError(err, type);
				}
			}
		}
	}

	/**
	 * Emits a user-defined custom event that is not part of the typed FlowtiEventMap.
	 *
	 * Custom events are picked up by wildcard (`"*"`) listeners, making them
	 * visible in the Activity Log and other wildcard-based consumers.
	 *
	 * @param type - Arbitrary event type string (e.g. "my.custom.event")
	 * @param payload - Optional payload data
	 */
	async emitCustom(type: string, payload?: unknown): Promise<void> {
		const event = {
			type,
			payload: payload ?? {},
			timestamp: new Date().toISOString(),
		};

		// Custom events have no typed handlers — only wildcard handlers
		const wildcardHandlers = this.handlers.get(WILDCARD);
		if (wildcardHandlers) {
			for (const handler of wildcardHandlers) {
				try {
					await (handler as WildcardEventHandler)(event as FlowtiEvents);
				} catch (err) {
					this.routeError(err, type);
				}
			}
		}
	}

	private routeError(error: unknown, eventType: string): void {
		if (this.onError) {
			this.onError(error, eventType);
		} else {
			console.error(`[Flowti] Unhandled error in "${eventType}" handler:`, error);
		}
	}

	/**
	 * Registers an event handler for a specific event type.
	 *
	 * The handler receives the full event object including type, payload, and timestamp.
	 * Multiple handlers can be registered for the same event type.
	 *
	 * @typeParam T - The event type, inferred from the `type` parameter
	 * @param type - The event type to listen for, or "*" for all events
	 * @param handler - The callback function to invoke when the event is emitted
	 * @returns An unsubscribe function that removes the handler when called
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = eventBus.on("user.updated", (event) => {
	 *   // event.type is "user.updated"
	 *   // event.payload is { user: FlowtiUser }
	 *   // event.timestamp is ISO string
	 * });
	 *
	 * // Cleanup when no longer needed
	 * unsubscribe();
	 * ```
	 *
	 * @example Wildcard listener
	 * ```typescript
	 * eventBus.on("*", (event) => {
	 *   console.log(`Event: ${event.type}`);
	 * });
	 * ```
	 */
	on<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
	on(type: "*", handler: WildcardEventHandler): () => void;
	on<T extends EventType>(
		type: T | "*",
		handler: EventHandler<T> | WildcardEventHandler
	): () => void {
		const key = type as EventType | typeof WILDCARD;
		if (!this.handlers.has(key)) {
			this.handlers.set(key, new Set());
		}
		this.handlers.get(key)!.add(handler as StoredHandler);

		return () => this.off(type as T, handler as EventHandler<T>);
	}

	/**
	 * Registers a one-time event handler that auto-unsubscribes after first call.
	 *
	 * Useful for handling events that should only be processed once, such as
	 * initialization events or one-time notifications.
	 *
	 * @typeParam T - The event type, inferred from the `type` parameter
	 * @param type - The event type to listen for
	 * @param handler - The callback function to invoke once
	 * @returns An unsubscribe function (can be called to cancel before event fires)
	 *
	 * @example
	 * ```typescript
	 * eventBus.once("user.created", (event) => {
	 *   showWelcomeMessage(event.payload.user);
	 * });
	 * ```
	 */
	once<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
		const wrappedHandler: EventHandler<T> = async (event) => {
			this.off(type, wrappedHandler);
			await handler(event);
		};
		return this.on(type, wrappedHandler);
	}

	/**
	 * Removes a specific event handler.
	 *
	 * The handler reference must be the same as the one passed to {@link on}.
	 * For easier cleanup, prefer using the unsubscribe function returned by {@link on}.
	 *
	 * @typeParam T - The event type
	 * @param type - The event type the handler was registered for
	 * @param handler - The handler function to remove
	 *
	 * @example
	 * ```typescript
	 * const handler = (event) => console.log(event);
	 * eventBus.on("user.created", handler);
	 *
	 * // Later:
	 * eventBus.off("user.created", handler);
	 * ```
	 */
	off<T extends EventType>(type: T, handler: EventHandler<T>): void;
	off(type: "*", handler: WildcardEventHandler): void;
	off<T extends EventType>(
		type: T | "*",
		handler: EventHandler<T> | WildcardEventHandler
	): void {
		const key = type as EventType | typeof WILDCARD;
		this.handlers.get(key)?.delete(handler as StoredHandler);
	}

	/**
	 * Removes all registered event handlers.
	 *
	 * Call this method during cleanup, typically in the plugin's `onunload` lifecycle hook,
	 * to prevent memory leaks and ensure handlers don't fire after the plugin is disabled.
	 *
	 * @example
	 * ```typescript
	 * async onunload() {
	 *   this.eventBus.clear();
	 * }
	 * ```
	 */
	clear(): void {
		this.handlers.clear();
	}
}
