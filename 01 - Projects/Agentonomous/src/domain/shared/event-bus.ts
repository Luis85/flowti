import type { PluginSettings } from '../settings/plugin-settings.js';
import type { Unsubscribe } from './unsubscribe.js';
import { generateId, timestamp } from './utils/identity.js';

export interface EventMap {
	log: { level: 'debug' | 'info' | 'error'; source: string; message: string; data?: unknown };
	error: { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
	settings: { previous: PluginSettings; current: PluginSettings };
	core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' };
	command: { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
}

export type EventEnvelope<K extends keyof EventMap = keyof EventMap> = {
	readonly channel: K;
	readonly payload: EventMap[K];
	readonly traceId: string;
	readonly eventId: string;
	readonly parentId?: string;
	readonly timestamp: number;
};

export interface EventBus {
	on<K extends keyof EventMap>(channel: K, listener: (envelope: EventEnvelope<K>) => void): Unsubscribe;
	emit<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string }): EventEnvelope<K>;
	onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe;
}

export function createEventBus(): EventBus {
	// channelListeners keys are keyof EventMap at runtime, typed as string for Map ergonomics.
	// Type safety is enforced at the on() and emit() API surfaces via generics.
	const channelListeners = new Map<string, Set<(envelope: never) => void>>();
	const anyListeners = new Set<(envelope: EventEnvelope) => void>();

	// eventId → traceId lookup for child-event trace correlation.
	// Grows unboundedly over a session — acceptable for a skeleton; production should add TTL eviction.
	// Unsubscribes intentionally do NOT prune entries — once emitted, trace membership is permanent.
	const traceMap = new Map<string, string>();

	function on<K extends keyof EventMap>(
		channel: K,
		listener: (envelope: EventEnvelope<K>) => void,
	): Unsubscribe {
		const key = channel as string;
		let set = channelListeners.get(key);
		if (set === undefined) {
			set = new Set();
			channelListeners.set(key, set);
		}
		// Cast is safe: the set for a given key only ever holds listeners for that key's type.
		set.add(listener as (envelope: never) => void);
		const capturedSet = set;
		return () => { capturedSet.delete(listener as (envelope: never) => void); };
	}

	function emit<K extends keyof EventMap>(
		channel: K,
		payload: EventMap[K],
		opts?: { parentId?: string },
	): EventEnvelope<K> {
		const eventId = generateId();
		let traceId: string;

		if (opts?.parentId !== undefined) {
			traceId = traceMap.get(opts.parentId) ?? generateId();
		} else {
			traceId = generateId();
		}

		traceMap.set(eventId, traceId);

		// exactOptionalPropertyTypes requires parentId to be absent (not undefined) when there is no parent.
		const envelope: EventEnvelope<K> = opts?.parentId !== undefined
			? { channel, payload, traceId, eventId, parentId: opts.parentId, timestamp: timestamp() }
			: { channel, payload, traceId, eventId, timestamp: timestamp() };

		const set = channelListeners.get(channel as string);
		if (set !== undefined) {
			for (const fn of set) {
				// Cast is safe: listeners in this set were registered for channel K.
				(fn as (envelope: EventEnvelope<K>) => void)(envelope);
			}
		}

		for (const fn of anyListeners) {
			// Cast is safe: EventEnvelope<K> is a subtype of EventEnvelope<keyof EventMap>.
			fn(envelope as EventEnvelope);
		}

		return envelope;
	}

	function onAny(listener: (envelope: EventEnvelope) => void): Unsubscribe {
		anyListeners.add(listener);
		return () => { anyListeners.delete(listener); };
	}

	return { on, emit, onAny };
}
