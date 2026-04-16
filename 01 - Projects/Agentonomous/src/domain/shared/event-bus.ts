import type { Unsubscribe } from './unsubscribe.js';
import { generateId, timestamp } from './utils/identity.js';
import { runWithConcurrency } from './utils/run-with-concurrency.js';
import './core-events.js';

export interface EventMap {}

export type EventEnvelope<K extends keyof EventMap = keyof EventMap> = {
	readonly channel: K;
	readonly payload: EventMap[K];
	readonly traceId: string;
	readonly eventId: string;
	readonly parentId?: string;
	readonly timestamp: number;
};

export interface EventBus {
	on<K extends keyof EventMap>(
		channel: K,
		listener: (envelope: EventEnvelope<K>) => void | Promise<void>,
		opts?: { priority?: number },
	): Unsubscribe;
	emit<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string }): EventEnvelope<K>;
	emitAsync<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string; maxConcurrency?: number }): Promise<EventEnvelope<K>>;
	onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe;
	listenerCount(channel?: keyof EventMap): number;
}

type ListenerEntry = {
	listener: (envelope: never) => void | Promise<void>;
	priority: number;
	insertionOrder: number;
};

export function createEventBus(opts?: { maxTraceEntries?: number }): EventBus {
	const maxTraceEntries = opts?.maxTraceEntries ?? 10000;

	// channelListeners holds sorted arrays of listener entries.
	// Sorted descending by priority; within same priority, ascending by insertionOrder (stable).
	const channelListeners = new Map<string, ListenerEntry[]>();
	const anyListeners: Array<(envelope: EventEnvelope) => void> = [];

	// eventId → traceId lookup for child-event trace correlation.
	const traceMap = new Map<string, string>();

	let insertionCounter = 0;

	function getListeners(key: string): ListenerEntry[] | undefined {
		return channelListeners.get(key);
	}

	function on<K extends keyof EventMap>(
		channel: K,
		listener: (envelope: EventEnvelope<K>) => void | Promise<void>,
		onOpts?: { priority?: number },
	): Unsubscribe {
		const key = channel as string;
		let entries = channelListeners.get(key);
		if (entries === undefined) {
			entries = [];
			channelListeners.set(key, entries);
		}

		const priority = onOpts?.priority ?? 0;
		const insertionOrder = insertionCounter++;

		const entry: ListenerEntry = {
			listener: listener as (envelope: never) => void | Promise<void>,
			priority,
			insertionOrder,
		};

		// Insert maintaining descending priority order, stable by insertionOrder within same priority.
		// Find the first position where existing entry has strictly lower priority.
		let insertAt = entries.length;
		for (let i = 0; i < entries.length; i++) {
			const existing = entries[i];
			if (existing !== undefined && existing.priority < priority) {
				insertAt = i;
				break;
			}
		}
		entries.splice(insertAt, 0, entry);

		return () => {
			const arr = channelListeners.get(key);
			if (arr === undefined) return;
			const idx = arr.indexOf(entry);
			if (idx !== -1) arr.splice(idx, 1);
		};
	}

	function buildEnvelope<K extends keyof EventMap>(
		channel: K,
		payload: EventMap[K],
		emitOpts?: { parentId?: string },
	): EventEnvelope<K> {
		const eventId = generateId();
		let traceId: string;

		if (emitOpts?.parentId !== undefined) {
			traceId = traceMap.get(emitOpts.parentId) ?? generateId();
		} else {
			traceId = generateId();
		}

		traceMap.set(eventId, traceId);

		// Evict oldest 25% when over the limit.
		if (traceMap.size > maxTraceEntries) {
			const evictCount = Math.floor(maxTraceEntries * 0.25);
			const iterator = traceMap.keys();
			for (let i = 0; i < evictCount; i++) {
				const key = iterator.next().value;
				if (key !== undefined) traceMap.delete(key);
			}
		}

		// exactOptionalPropertyTypes requires parentId to be absent (not undefined) when there is no parent.
		const envelope: EventEnvelope<K> = emitOpts?.parentId !== undefined
			? { channel, payload, traceId, eventId, parentId: emitOpts.parentId, timestamp: timestamp() }
			: { channel, payload, traceId, eventId, timestamp: timestamp() };

		return envelope;
	}

	function emit<K extends keyof EventMap>(
		channel: K,
		payload: EventMap[K],
		emitOpts?: { parentId?: string },
	): EventEnvelope<K> {
		const envelope = buildEnvelope(channel, payload, emitOpts);

		const entries = getListeners(channel as string);
		if (entries !== undefined) {
			// Snapshot before iterating to handle unsubscribe/subscribe during dispatch.
			const snapshot = [...entries];
			for (const entry of snapshot) {
				// Cast is safe: listeners in this array were registered for channel K.
				(entry.listener as (envelope: EventEnvelope<K>) => void)(envelope);
			}
		}

		// Snapshot anyListeners as well.
		const anySnapshot = [...anyListeners];
		for (const fn of anySnapshot) {
			// Cast is safe: EventEnvelope<K> is a subtype of EventEnvelope<keyof EventMap>.
			fn(envelope as EventEnvelope);
		}

		return envelope;
	}

	async function emitAsync<K extends keyof EventMap>(
		channel: K,
		payload: EventMap[K],
		emitOpts?: { parentId?: string; maxConcurrency?: number },
	): Promise<EventEnvelope<K>> {
		const envelope = buildEnvelope(channel, payload, emitOpts);
		const maxConcurrency = emitOpts?.maxConcurrency ?? Infinity;

		const entries = getListeners(channel as string);

		if (entries !== undefined) {
			const snapshot = [...entries];
			const tasks = snapshot.map((entry) => () =>
				(entry.listener as (envelope: EventEnvelope<K>) => void | Promise<void>)(envelope),
			);
			await runWithConcurrency(tasks, maxConcurrency);
		}

		const anySnapshot = [...anyListeners];
		for (const fn of anySnapshot) {
			fn(envelope as EventEnvelope);
		}

		return envelope;
	}

	function onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe {
		anyListeners.push(listener);
		return () => {
			const idx = anyListeners.indexOf(listener);
			if (idx !== -1) anyListeners.splice(idx, 1);
		};
	}

	function listenerCount(channel?: keyof EventMap): number {
		if (channel !== undefined) {
			return channelListeners.get(channel as string)?.length ?? 0;
		}
		let total = anyListeners.length;
		for (const entries of channelListeners.values()) {
			total += entries.length;
		}
		return total;
	}

	return { on, emit, emitAsync, onAny, listenerCount };
}
