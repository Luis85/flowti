import type { GameEvent, EventHandler, Unsubscribe, EventFilter } from '../domain/core/events.js';
import type { BatchableEventBus } from './engine/batchable-event-bus.js';

/**
 * EventBus implementation with priority ordering, history, filter, and batching support.
 *
 * Batching: when beginBatch() is called, emit() queues events instead of dispatching.
 * flushBatch() delivers all queued events and returns to immediate mode.
 * The tick runner uses this to deliver events between system executions.
 */

interface PrioritizedHandler {
	handler: EventHandler;
	priority: number;
}

const HISTORY_MAX = 500;

export function createEventBus(): BatchableEventBus {
	const handlers = new Map<string, PrioritizedHandler[]>();
	const anyHandlers: PrioritizedHandler[] = [];
	const eventHistory: GameEvent[] = [];
	let batching = false;
	let batchQueue: GameEvent[] = [];

	function addHandler(map: Map<string, PrioritizedHandler[]>, type: string, handler: EventHandler, priority: number): void {
		const existing = map.get(type);
		const list = existing ?? [];
		if (existing === undefined) map.set(type, list);
		list.push({ handler, priority });
		list.sort((a, b) => a.priority - b.priority);
	}

	function dispatch(event: GameEvent): void {
		const typed = handlers.get(event.type);
		if (typed !== undefined) {
			for (const { handler } of typed) handler(event);
		}
		for (const { handler } of anyHandlers) handler(event);
	}

	return {
		emit(event: GameEvent): void {
			eventHistory.push(event);
			if (eventHistory.length > HISTORY_MAX) eventHistory.shift();

			if (batching) {
				batchQueue.push(event);
			} else {
				dispatch(event);
			}
		},

		on(type: string, handler: EventHandler, priority = 100): Unsubscribe {
			addHandler(handlers, type, handler, priority);
			return () => {
				const list = handlers.get(type);
				if (list !== undefined) {
					const idx = list.findIndex((h) => h.handler === handler);
					if (idx >= 0) list.splice(idx, 1);
				}
			};
		},

		off(type: string, handler: EventHandler): void {
			const list = handlers.get(type);
			if (list !== undefined) {
				const idx = list.findIndex((h) => h.handler === handler);
				if (idx >= 0) list.splice(idx, 1);
			}
		},

		onAny(handler: EventHandler): Unsubscribe {
			const entry: PrioritizedHandler = { handler, priority: 100 };
			anyHandlers.push(entry);
			return () => {
				const idx = anyHandlers.indexOf(entry);
				if (idx >= 0) anyHandlers.splice(idx, 1);
			};
		},

		filter(predicate: EventFilter, handler: EventHandler): Unsubscribe {
			const wrappedHandler: EventHandler = (event) => {
				if (predicate(event)) handler(event);
			};
			const entry: PrioritizedHandler = { handler: wrappedHandler, priority: 100 };
			anyHandlers.push(entry);
			return () => {
				const idx = anyHandlers.indexOf(entry);
				if (idx >= 0) anyHandlers.splice(idx, 1);
			};
		},

		history(filter?: { type?: string; source?: string; limit?: number }): GameEvent[] {
			let results = [...eventHistory];
			if (filter?.type !== undefined) results = results.filter((e) => e.type === filter.type);
			if (filter?.source !== undefined) results = results.filter((e) => e.source === filter.source);
			if (filter?.limit !== undefined) results = results.slice(-filter.limit);
			return results;
		},

		beginBatch(): void {
			batching = true;
			batchQueue = [];
		},

		flushBatch(): void {
			batching = false;
			const queued = batchQueue;
			batchQueue = [];
			for (const event of queued) {
				dispatch(event);
			}
		},
	};
}
