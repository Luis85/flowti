import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EventEnvelope } from '../../domain/shared/event-bus.js';

const pending: EventEnvelope[] = [];
let maxBuffer = 500;

export function pushEvent(envelope: EventEnvelope): void {
	pending.push(envelope);
	if (pending.length > maxBuffer) {
		pending.splice(0, pending.length - maxBuffer);
	}
}

export function setMaxBufferSize(max: number): void {
	maxBuffer = max;
	if (pending.length > max) {
		pending.splice(0, pending.length - max);
	}
}

export function clearPending(): void {
	pending.length = 0;
}

export const useEventInspectorStore = defineStore('event-inspector', () => {
	const events = ref<EventEnvelope[]>(pending.splice(0));
	const maxEvents = ref<number>(maxBuffer);
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
