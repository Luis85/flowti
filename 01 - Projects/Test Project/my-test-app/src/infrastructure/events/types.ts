import type { AppEventMap } from "./events";

export type EventType = keyof AppEventMap;

export interface FlowtiEvent<
	T extends EventType = EventType,
	P = AppEventMap[T],
> {
	readonly type: T;
	readonly payload: P;
	readonly timestamp: string;
}

export type FlowtiEvents = {
	[K in EventType]: FlowtiEvent<K, AppEventMap[K]>;
}[EventType];

export type EventPayload<T extends EventType> = AppEventMap[T];

export type EventHandler<T extends EventType = EventType> = (
	event: FlowtiEvent<T, AppEventMap[T]>
) => void | Promise<void>;

export type WildcardEventHandler = (event: FlowtiEvents) => void | Promise<void>;

export interface IEventBus {
	emit<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void>;
	on<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
	on(type: "*", handler: WildcardEventHandler): () => void;
	once<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
	off<T extends EventType>(type: T, handler: EventHandler<T>): void;
	off(type: "*", handler: WildcardEventHandler): void;
	clear(): void;
}
