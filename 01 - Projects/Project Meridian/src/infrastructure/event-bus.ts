import type { GameEvent, EventHandler, EventBus, Unsubscribe, EventFilter } from '../domain/core/events.js';

/**
 * EventBus implementation with priority ordering, history, and filter support.
 *
 * NOTE: Event batching (GDD §14.1, ADR-05) is not yet implemented.
 * Currently, emit() dispatches synchronously to all handlers.
 * When the tick loop is built, batching should be added so that events
 * emitted by system N are collected and delivered before system N+1 runs.
 * This prevents mid-tick event cascades.
 */

interface PrioritizedHandler {
	handler: EventHandler;
	priority: number;
}

const HISTORY_MAX = 500;

export function createEventBus(): EventBus {
	const handlers = new Map<string, PrioritizedHandler[]>();
	const anyHandlers: PrioritizedHandler[] = [];
	const eventHistory: GameEvent[] = [];

	function addHandler(map: Map<string, PrioritizedHandler[]>, type: string, handler: EventHandler, priority: number): void {
		const existing = map.get(type);
		const list = existing ?? [];
		if (existing === undefined) map.set(type, list);
		list.push({ handler, priority });
		list.sort((a, b) => a.priority - b.priority);
	}

	return {
		emit(event: GameEvent): void {
			eventHistory.push(event);
			if (eventHistory.length > HISTORY_MAX) eventHistory.shift();

			const typed = handlers.get(event.type);
			if (typed !== undefined) {
				for (const { handler } of typed) handler(event);
			}
			for (const { handler } of anyHandlers) handler(event);
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
	};
}
