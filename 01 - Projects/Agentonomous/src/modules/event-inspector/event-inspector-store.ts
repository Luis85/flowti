import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EventEnvelope } from '../../domain/shared/event-bus.js';
import type { EventBuffer } from './event-inspector-buffer.js';

/**
 * Creates a reactive Pinia store backed by a plain-TS EventBuffer.
 * The store is created lazily when the sidebar view mounts — keeping the
 * module itself free of Vue/Pinia imports.
 */
export function createEventInspectorStore(buffer: EventBuffer) {
	return defineStore('event-inspector', () => {
		const events = ref<EventEnvelope[]>([...buffer.getAll()]);
		const filterChannels = ref<string[]>([]);

		// Sync with the buffer whenever it changes (add / clear / setMax).
		const stopSync = buffer.onChange(() => {
			events.value = [...buffer.getAll()];
		});

		const filteredEvents = computed(() => {
			if (filterChannels.value.length === 0) return events.value;
			return events.value.filter((e) => filterChannels.value.includes(e.channel as string));
		});

		const traceGroups = computed(() => {
			const groups = new Map<string, EventEnvelope[]>();
			for (const event of events.value) {
				const existing = groups.get(event.traceId);
				if (existing !== undefined) {
					existing.push(event);
				} else {
					groups.set(event.traceId, [event]);
				}
			}
			return groups;
		});

		function setFilterChannels(channels: string[]): void {
			filterChannels.value = channels;
		}

		function clear(): void {
			buffer.clear();
		}

		function dispose(): void {
			stopSync();
		}

		return { events, filteredEvents, traceGroups, filterChannels, setFilterChannels, clear, dispose };
	});
}

/**
 * Standalone store definition (no buffer) for use in unit tests that
 * want to drive the store directly without going through a module.
 */
export const useEventInspectorStore = defineStore('event-inspector', () => {
	const events = ref<EventEnvelope[]>([]);
	const maxEvents = ref<number>(500);
	const filterChannels = ref<string[]>([]);

	const filteredEvents = computed(() => {
		if (filterChannels.value.length === 0) return events.value;
		return events.value.filter((e) => filterChannels.value.includes(e.channel as string));
	});

	const traceGroups = computed(() => {
		const groups = new Map<string, EventEnvelope[]>();
		for (const event of events.value) {
			const existing = groups.get(event.traceId);
			if (existing !== undefined) {
				existing.push(event);
			} else {
				groups.set(event.traceId, [event]);
			}
		}
		return groups;
	});

	function addEvent(envelope: EventEnvelope): void {
		events.value = [...events.value.slice(-(maxEvents.value - 1)), envelope];
	}

	function setMaxEvents(max: number): void {
		maxEvents.value = max;
		if (events.value.length > max) {
			events.value = events.value.slice(-max);
		}
	}

	function setFilterChannels(channels: string[]): void {
		filterChannels.value = channels;
	}

	function clear(): void {
		events.value = [];
	}

	return { events, filteredEvents, traceGroups, maxEvents, filterChannels, addEvent, setMaxEvents, setFilterChannels, clear };
});
