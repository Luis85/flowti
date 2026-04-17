<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useEventInspectorStore } from '../event-inspector-store.js';
import PanelLayout from '../../../ui/layouts/PanelLayout.vue';
import type { EventEnvelope } from '../../../domain/shared/event-bus.js';

const store = useEventInspectorStore();
const { filteredEvents } = storeToRefs(store);

const filterInput = ref('');

function formatChannel(env: EventEnvelope): string {
	return String(env.channel);
}

function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString();
}

function applyFilter(): void {
	const channels = filterInput.value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	store.setFilterChannels(channels);
}

function clearEvents(): void {
	store.clear();
}
</script>

<template>
	<PanelLayout>
		<template #header>Event Inspector</template>

		<div class="event-inspector">
			<div class="event-inspector__toolbar">
				<input
					v-model="filterInput"
					class="event-inspector__filter"
					data-testid="event-filter"
					placeholder="Filter channels (comma-separated)"
					@input="applyFilter"
				>
				<button class="event-inspector__clear" data-testid="event-clear" @click="clearEvents">Clear</button>
			</div>

			<div class="event-inspector__count" data-testid="event-count">{{ filteredEvents.length }} event(s)</div>

			<ul class="event-inspector__list" data-testid="event-list">
				<li
					v-for="env in filteredEvents"
					:key="env.eventId"
					class="event-inspector__item"
					data-testid="event-item"
				>
					<span class="event-inspector__channel">{{ formatChannel(env) }}</span>
					<span class="event-inspector__time">{{ formatTime(env.timestamp) }}</span>
					<span class="event-inspector__trace" :title="env.traceId">
						{{ env.traceId.slice(0, 8) }}
					</span>
				</li>
			</ul>

			<div v-if="filteredEvents.length === 0" class="event-inspector__empty" data-testid="event-empty">
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
