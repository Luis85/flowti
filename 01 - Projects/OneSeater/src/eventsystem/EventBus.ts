// ═══════════════════════════════════════════════════════════════════════════════
// EVENT BUS WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wraps sim-ecs EventBus to:
// 1. Isolate the dependency in one file
// 2. Provide a simpler interface for UI components
// 3. Allow future replacement of the underlying implementation
//
// ═══════════════════════════════════════════════════════════════════════════════

import { IEventBus as SimEcsEventBus } from "sim-ecs";

// ─────────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────────

/** Event class constructor type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventType<T = unknown> = new (...args: any[]) => T;

/** Event handler function */
export type EventHandler<T> = (event: T) => void;

/** Event reader interface */
export interface IEventReader<T> {
	iter(): IterableIterator<Readonly<T>>;
	iterMut(): IterableIterator<T>;
}

/** Event writer interface */
export interface IEventWriter<T> {
	publish(event: T): void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Simplified Interface for UI Components
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simplified EventBus interface for UI components.
 * Hides complexity of readers/writers for simple pub/sub usage.
 */
export interface IEventBus {
	subscribe<T>(eventType: EventType<T>, handler: (event: T) => void): void;
	unsubscribe<T>(eventType: EventType<T>, handler: (event: T) => void): void;
	publish<T extends object>(event: T): void | Promise<void>;
	setDebug(debug: boolean): void;
}

/**
 * Extended EventBus interface with reader/writer support.
 * For systems that need batch processing or deferred reads.
 */
export interface IEventBusExtended extends IEventBus {
	createReader<T>(eventType: EventType<T>): IEventReader<T>;
	createWriter<T>(): IEventWriter<T>;
	subscribeReader<T>(reader: IEventReader<T>): void;
	unsubscribeReader<T>(reader: IEventReader<T>): void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Adapter Implementation
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Adapter that wraps sim-ecs EventBus.
 * Provides both simple and extended interfaces.
 *
 * @remarks
 * Internal casts to `any` are intentional to bridge between our clean public API
 * and sim-ecs internals without exposing internal sim-ecs types.
 */
export class EventBusAdapter implements IEventBusExtended {
	constructor(
		private readonly bus: SimEcsEventBus,
		private debug = false
	) {}

	setDebug(debug: boolean): void {
		this.debug = debug;
	}

	subscribe<T>(eventType: EventType<T>, handler: (event: T) => void): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.bus.subscribe(eventType as any, handler as any);
	}

	unsubscribe<T>(eventType: EventType<T>, handler: (event: T) => void): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.bus.unsubscribe(eventType as any, handler as any);
	}

	publish<T extends object>(event: T): void | Promise<void> {
		return this.bus.publish(event);
	}

	createReader<T>(eventType: EventType<T>): IEventReader<T> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.bus.createReader(eventType as any) as any;
	}

	createWriter<T>(): IEventWriter<T> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.bus.createWriter() as any;
	}

	subscribeReader<T>(reader: IEventReader<T>): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.bus.subscribeReader(reader as any);
	}

	unsubscribeReader<T>(reader: IEventReader<T>): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.bus.unsubscribeReader(reader as any);
	}
}

// ─────────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create an EventBus adapter from a sim-ecs EventBus instance.
 *
 * @example
 * ```typescript
 * import { buildWorld } from "sim-ecs";
 * import { createEventBus } from "./EventBus";
 *
 * const world = buildWorld().build();
 * const events = createEventBus(world.eventBus);
 *
 * // Simple usage
 * events.subscribe(MyEvent, (e) => console.log(e));
 * events.publish(new MyEvent());
 * ```
 */
export function createEventBus(simEcsBus: SimEcsEventBus, debug = false): IEventBusExtended {
	return new EventBusAdapter(simEcsBus, debug);
}

// ─────────────────────────────────────────────────────────────────────────────────
// Utility Types for Event Definition
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Helper type to extract event instance type from event class.
 *
 * @example
 * ```typescript
 * class MyEvent { constructor(public value: number) {} }
 * type MyEventInstance = EventInstance<typeof MyEvent>; // MyEvent
 * ```
 */
export type EventInstance<T extends EventType> = T extends new (...args: unknown[]) => infer R
	? R
	: never;
