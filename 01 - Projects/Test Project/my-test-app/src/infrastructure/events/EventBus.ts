import type {
	EventHandler,
	EventPayload,
	EventType,
	FlowtiEvent,
	FlowtiEvents,
	IEventBus,
	WildcardEventHandler,
} from "./types";

const WILDCARD = "*" as const;
type StoredHandler = EventHandler | WildcardEventHandler;

export class EventBus implements IEventBus {
	private handlers: Map<EventType | typeof WILDCARD, Set<StoredHandler>>;

	constructor() {
		this.handlers = new Map();
	}

	async emit<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void> {
		const event: FlowtiEvent<T> = {
			type,
			payload,
			timestamp: new Date().toISOString(),
		};

		const typeHandlers = this.handlers.get(type);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				try {
					await (handler as EventHandler<T>)(event);
				} catch (err) {
					console.error(`[EventBus] Error in "${type}" handler:`, err);
				}
			}
		}

		const wildcardHandlers = this.handlers.get(WILDCARD);
		if (wildcardHandlers) {
			for (const handler of wildcardHandlers) {
				try {
					await (handler as WildcardEventHandler)(event as FlowtiEvents);
				} catch (err) {
					console.error(`[EventBus] Error in wildcard handler for "${type}":`, err);
				}
			}
		}
	}

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

	once<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
		const wrappedHandler: EventHandler<T> = async (event) => {
			this.off(type, wrappedHandler);
			await handler(event);
		};
		return this.on(type, wrappedHandler);
	}

	off<T extends EventType>(type: T, handler: EventHandler<T>): void;
	off(type: "*", handler: WildcardEventHandler): void;
	off<T extends EventType>(
		type: T | "*",
		handler: EventHandler<T> | WildcardEventHandler
	): void {
		const key = type as EventType | typeof WILDCARD;
		this.handlers.get(key)?.delete(handler as StoredHandler);
	}

	clear(): void {
		this.handlers.clear();
	}
}
