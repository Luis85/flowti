<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { EventEnvelope } from '../../../domain/shared/event-bus.js';
import { getEventBuffer } from '../event-inspector-module.js';
import { createEventInspectorStore } from '../event-inspector-store.js';
import { createPinia } from 'pinia';
import PanelLayout from '../../../ui/layouts/PanelLayout.vue';

// Each sidebar leaf gets its own Pinia instance to avoid cross-leaf state collision.
const pinia = createPinia();
const buffer = getEventBuffer();

const filterInput = ref('');

// If the module is running, wire the buffer-backed store; otherwise fall back
// to an empty reactive list so the panel renders cleanly even when disabled.
let store: ReturnType<ReturnType<typeof createEventInspectorStore>> | null = null;
const standaloneEvents = ref<EventEnvelope[]>([]);

if (buffer !== null) {
	const useStore = createEventInspectorStore(buffer);
	store = useStore(pinia);
}

const events = computed(() =>
	store !== null ? store.filteredEvents : standaloneEvents.value,
);

function formatChannel(env: EventEnvelope): string {
	return String(env.channel);
}

function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString();
}

function applyFilter(): void {
	if (store === null) return;
	const channels = filterInput.value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	store.setFilterChannels(channels);
}

function clearEvents(): void {
	if (store !== null) {
		store.clear();
	} else {
		standaloneEvents.value = [];
	}
}

onMounted(() => {
	// Nothing extra needed — the buffer.onChange callback keeps store in sync.
});

onUnmounted(() => {
	store?.dispose();
});
</script>

<template>
	<PanelLayout>
		<template #header>Event Inspector</template>

		<div class="event-inspector">
			<div class="event-inspector__toolbar">
				<input
					v-model="filterInput"
					class="event-inspector__filter"
					placeholder="Filter channels (comma-separated)"
					@input="applyFilter"
				/>
				<button class="event-inspector__clear" @click="clearEvents">Clear</button>
			</div>

			<div class="event-inspector__count">{{ events.length }} event(s)</div>

			<ul class="event-inspector__list">
				<li
					v-for="env in events"
					:key="env.eventId"
					class="event-inspector__item"
				>
					<span class="event-inspector__channel">{{ formatChannel(env) }}</span>
					<span class="event-inspector__time">{{ formatTime(env.timestamp) }}</span>
					<span class="event-inspector__trace" :title="env.traceId">
						{{ env.traceId.slice(0, 8) }}
					</span>
				</li>
			</ul>

			<div v-if="events.length === 0" class="event-inspector__empty">
				No events captured yet.
			</div>
		</div>
	</PanelLayout>
</template>

<style scoped>
.event-inspector {
	display: flex;
	flex-direction: column;
	height: 100%;
	font-size: 12px;
}

.event-inspector__toolbar {
	display: flex;
	gap: 4px;
	margin-bottom: 6px;
}

.event-inspector__filter {
	flex: 1;
}

.event-inspector__count {
	color: var(--text-muted);
	margin-bottom: 4px;
}

.event-inspector__list {
	flex: 1;
	overflow-y: auto;
	list-style: none;
	margin: 0;
	padding: 0;
}

.event-inspector__item {
	display: flex;
	gap: 8px;
	padding: 2px 0;
	border-bottom: 1px solid var(--background-modifier-border);
}

.event-inspector__channel {
	font-weight: 600;
	min-width: 80px;
}

.event-inspector__time {
	color: var(--text-muted);
}

.event-inspector__trace {
	color: var(--text-faint);
	font-family: monospace;
}

.event-inspector__empty {
	color: var(--text-muted);
	text-align: center;
	padding-top: 16px;
}
</style>
