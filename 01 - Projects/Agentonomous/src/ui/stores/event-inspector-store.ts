import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EventEnvelope } from '../../domain/shared/event-bus.js';
import { summarizeEnvelope } from '../../domain/shared/event-summary.js';
import { safeJsonStringify } from '../../domain/shared/utils/safe-json-stringify.js';

export const useEventInspectorStore = defineStore('event-inspector', () => {
	const events = ref<EventEnvelope[]>([]);
	const maxEvents = ref<number>(500);
	const filterChannels = ref<string[]>([]);
	const searchQuery = ref<string>('');
	const groupByTrace = ref<boolean>(false);
	const paused = ref<boolean>(false);
	const pendingWhilePaused = ref<EventEnvelope[]>([]);

	function matchesSearch(env: EventEnvelope, q: string): boolean {
		if (summarizeEnvelope(env).toLowerCase().includes(q)) return true;
		if (String(env.channel).toLowerCase().includes(q)) return true;
		if (safeJsonStringify(env.payload, 0).toLowerCase().includes(q)) return true;
		return false;
	}

	const filteredEvents = computed(() => {
		let result: readonly EventEnvelope[] = events.value;
		if (filterChannels.value.length > 0) {
			const allowed = new Set(filterChannels.value);
			result = result.filter((e) => allowed.has(String(e.channel)));
		}
		if (searchQuery.value.length > 0) {
			const q = searchQuery.value.toLowerCase();
			result = result.filter((e) => matchesSearch(e, q));
		}
		return result;
	});

	const traceGroups = computed(() => {
		const groups = new Map<string, EventEnvelope[]>();
		for (const event of events.value) {
			const existing = groups.get(event.traceId);
			if (existing !== undefined) existing.push(event);
			else groups.set(event.traceId, [event]);
		}
		return groups;
	});

	const filteredTraceGroups = computed(() => {
		const visible = new Set(filteredEvents.value.map((e) => e.eventId));
		const groups: Array<[string, EventEnvelope[]]> = [];
		for (const [traceId, all] of traceGroups.value) {
			const shown = all.filter((e) => visible.has(e.eventId));
			if (shown.length > 0) groups.push([traceId, shown]);
		}
		return groups;
	});

	const pendingCount = computed(() => pendingWhilePaused.value.length);

	function addEvent(envelope: EventEnvelope): void {
		if (paused.value) {
			pendingWhilePaused.value = [...pendingWhilePaused.value, envelope];
			return;
		}
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

	function setSearchQuery(query: string): void {
		searchQuery.value = query;
	}

	function setGroupByTrace(enabled: boolean): void {
		groupByTrace.value = enabled;
	}

	function togglePause(): void {
		if (paused.value) {
			const pending = pendingWhilePaused.value;
			pendingWhilePaused.value = [];
			paused.value = false;
			for (const ev of pending) {
				events.value = [...events.value.slice(-(maxEvents.value - 1)), ev];
			}
		} else {
			paused.value = true;
		}
	}

	function clear(): void {
		events.value = [];
		pendingWhilePaused.value = [];
	}

	return {
		events,
		filteredEvents,
		traceGroups,
		filteredTraceGroups,
		maxEvents,
		filterChannels,
		searchQuery,
		groupByTrace,
		paused,
		pendingCount,
		addEvent,
		setMaxEvents,
		setFilterChannels,
		setSearchQuery,
		setGroupByTrace,
		togglePause,
		clear,
	};
});
