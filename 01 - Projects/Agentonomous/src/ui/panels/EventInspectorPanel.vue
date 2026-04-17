<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEventInspectorStore } from '../stores/event-inspector-store.js';
import PanelLayout from '../layouts/PanelLayout.vue';
import { summarizeEnvelope, formatEventTime } from '../../domain/shared/event-summary.js';
import { safeJsonStringify } from '../../domain/shared/utils/safe-json-stringify.js';
import type { EventEnvelope } from '../../domain/shared/event-bus.js';

const store = useEventInspectorStore();
const { filteredEvents, filteredTraceGroups, groupByTrace, paused, pendingCount } = storeToRefs(store);

const channelFilterInput = ref('');
const expanded = ref<Set<string>>(new Set());

const pauseLabel = computed(() => paused.value ? 'Resume' : 'Pause');
const pauseBadge = computed(() => paused.value && pendingCount.value > 0 ? `+${String(pendingCount.value)}` : '');

function applyChannelFilter(): void {
	const channels = channelFilterInput.value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	store.setFilterChannels(channels);
}

function onSearchInput(event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	store.setSearchQuery(value);
}

function onGroupToggle(event: Event): void {
	store.setGroupByTrace((event.target as HTMLInputElement).checked);
}

function clearEvents(): void {
	store.clear();
	expanded.value = new Set();
}

function togglePause(): void {
	store.togglePause();
}

function toggleExpand(eventId: string): void {
	const next = new Set(expanded.value);
	if (next.has(eventId)) next.delete(eventId);
	else next.add(eventId);
	expanded.value = next;
}

function onRowKeydown(event: KeyboardEvent, eventId: string): void {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		toggleExpand(eventId);
	}
}

function formatPayload(payload: unknown): string {
	return safeJsonStringify(payload);
}

function summary(env: EventEnvelope): string {
	return summarizeEnvelope(env);
}
</script>

<template>
	<PanelLayout>
		<template #header>Event Inspector</template>

		<div class="event-inspector">
			<div class="event-inspector__toolbar">
				<input
					v-model="channelFilterInput"
					class="event-inspector__filter"
					data-testid="event-filter"
					placeholder="channels (e.g. log,core)"
					@input="applyChannelFilter"
				>
				<input
					:value="store.searchQuery"
					class="event-inspector__search"
					data-testid="event-search"
					placeholder="search payload…"
					@input="onSearchInput"
				>
			</div>

			<div class="event-inspector__controls">
				<label class="event-inspector__toggle">
					<input
						type="checkbox"
						:checked="groupByTrace"
						data-testid="event-group-toggle"
						@change="onGroupToggle"
					>
					Group by trace
				</label>
				<button
					type="button"
					class="event-inspector__pause"
					:class="{ 'event-inspector__pause--paused': paused }"
					data-testid="event-pause"
					@click="togglePause"
				>
					{{ pauseLabel }}<span v-if="pauseBadge" class="event-inspector__badge">{{ pauseBadge }}</span>
				</button>
				<button
					type="button"
					class="event-inspector__clear"
					data-testid="event-clear"
					@click="clearEvents"
				>
					Clear
				</button>
			</div>

			<div class="event-inspector__count" data-testid="event-count">
				{{ filteredEvents.length }} event(s)<span v-if="paused" class="event-inspector__paused-note"> (paused)</span>
			</div>

			<!-- Flat list -->
			<ul v-if="!groupByTrace" class="event-inspector__list" data-testid="event-list">
				<li
					v-for="env in filteredEvents"
					:key="env.eventId"
					class="event-inspector__item"
					:class="{ 'event-inspector__item--expanded': expanded.has(env.eventId) }"
					data-testid="event-item"
				>
					<div
						role="button"
						tabindex="0"
						class="event-inspector__row"
						data-testid="event-row"
						@click="toggleExpand(env.eventId)"
						@keydown="onRowKeydown($event, env.eventId)"
					>
						<span class="event-inspector__time">{{ formatEventTime(env.timestamp) }}</span>
						<span class="event-inspector__channel">{{ String(env.channel) }}</span>
						<span class="event-inspector__summary" data-testid="event-summary">
							{{ summary(env) }}
						</span>
						<span class="event-inspector__trace" :title="env.traceId">
							{{ env.traceId.slice(0, 8) }}
						</span>
					</div>
					<div
						v-if="expanded.has(env.eventId)"
						class="event-inspector__detail"
						data-testid="event-detail"
					>
						<dl>
							<dt>eventId</dt>
							<dd>{{ env.eventId }}</dd>
							<dt>traceId</dt>
							<dd>{{ env.traceId }}</dd>
							<dt v-if="env.parentId !== undefined">parentId</dt>
							<dd v-if="env.parentId !== undefined">{{ env.parentId }}</dd>
							<dt>payload</dt>
							<dd><pre>{{ formatPayload(env.payload) }}</pre></dd>
						</dl>
					</div>
				</li>
			</ul>

			<!-- Grouped by trace -->
			<ul v-else class="event-inspector__trace-list" data-testid="event-trace-list">
				<li
					v-for="[traceId, group] in filteredTraceGroups"
					:key="traceId"
					class="event-inspector__trace-group"
					data-testid="event-trace-group"
				>
					<div class="event-inspector__trace-header">
						<span class="event-inspector__trace-id" :title="traceId">{{ traceId.slice(0, 8) }}</span>
						<span class="event-inspector__trace-count">{{ group.length }} event(s)</span>
					</div>
					<ul class="event-inspector__list event-inspector__list--nested">
						<li
							v-for="env in group"
							:key="env.eventId"
							class="event-inspector__item"
							:class="{ 'event-inspector__item--expanded': expanded.has(env.eventId) }"
							data-testid="event-item"
						>
							<div
								role="button"
								tabindex="0"
								class="event-inspector__row"
								data-testid="event-row"
								@click="toggleExpand(env.eventId)"
								@keydown="onRowKeydown($event, env.eventId)"
							>
								<span class="event-inspector__time">{{ formatEventTime(env.timestamp) }}</span>
								<span class="event-inspector__channel">{{ String(env.channel) }}</span>
								<span class="event-inspector__summary">{{ summary(env) }}</span>
							</div>
							<div
								v-if="expanded.has(env.eventId)"
								class="event-inspector__detail"
								data-testid="event-detail"
							>
								<dl>
									<dt>eventId</dt>
									<dd>{{ env.eventId }}</dd>
									<dt v-if="env.parentId !== undefined">parentId</dt>
									<dd v-if="env.parentId !== undefined">{{ env.parentId }}</dd>
									<dt>payload</dt>
									<dd><pre>{{ formatPayload(env.payload) }}</pre></dd>
								</dl>
							</div>
						</li>
					</ul>
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
	gap: 6px;
}

.event-inspector__toolbar,
.event-inspector__controls {
	display: flex;
	gap: 4px;
	align-items: center;
}

.event-inspector__filter,
.event-inspector__search {
	flex: 1;
	min-width: 0;
}

.event-inspector__toggle {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-right: auto;
	color: var(--text-muted);
	cursor: pointer;
	user-select: none;
}

.event-inspector__pause,
.event-inspector__clear {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.event-inspector__pause--paused {
	background: var(--background-modifier-success, var(--interactive-accent));
}

.event-inspector__badge {
	display: inline-block;
	padding: 0 6px;
	border-radius: 8px;
	background: var(--background-modifier-border);
	color: var(--text-normal);
	font-size: 10px;
	font-weight: 600;
}

.event-inspector__count {
	color: var(--text-muted);
}

.event-inspector__paused-note {
	color: var(--text-accent);
	margin-left: 4px;
}

.event-inspector__list,
.event-inspector__trace-list {
	flex: 1;
	overflow-y: auto;
	list-style: none;
	margin: 0;
	padding: 0;
}

.event-inspector__list--nested {
	flex: 0 0 auto;
	overflow: visible;
	padding-left: 12px;
	border-left: 1px solid var(--background-modifier-border);
	margin-top: 2px;
}

.event-inspector__item {
	border-bottom: 1px solid var(--background-modifier-border);
}

.event-inspector__row {
	display: grid;
	grid-template-columns: 90px 110px 1fr 70px;
	align-items: baseline;
	gap: 8px;
	width: 100%;
	padding: 3px 4px;
	cursor: pointer;
	user-select: none;
	border-radius: 3px;
}

.event-inspector__row:hover,
.event-inspector__row:focus-visible {
	background: var(--background-modifier-hover);
	outline: none;
}

.event-inspector__time {
	color: var(--text-muted);
	font-family: var(--font-monospace, monospace);
}

.event-inspector__channel {
	font-weight: 600;
}

.event-inspector__summary {
	color: var(--text-normal);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.event-inspector__trace {
	color: var(--text-faint);
	font-family: var(--font-monospace, monospace);
	text-align: right;
}

.event-inspector__trace-group {
	margin-bottom: 6px;
}

.event-inspector__trace-header {
	display: flex;
	justify-content: space-between;
	padding: 2px 4px;
	background: var(--background-secondary);
	border-radius: 3px;
	font-weight: 600;
}

.event-inspector__trace-id {
	font-family: var(--font-monospace, monospace);
	color: var(--text-accent);
}

.event-inspector__trace-count {
	color: var(--text-muted);
	font-weight: normal;
}

.event-inspector__detail {
	padding: 6px 8px 8px 98px;
	background: var(--background-secondary);
}

.event-inspector__detail dl {
	margin: 0;
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: 2px 10px;
}

.event-inspector__detail dt {
	color: var(--text-muted);
	font-weight: 600;
	font-family: var(--font-monospace, monospace);
}

.event-inspector__detail dd {
	margin: 0;
	word-break: break-word;
}

.event-inspector__detail pre {
	margin: 0;
	padding: 4px 6px;
	background: var(--background-primary);
	border-radius: 3px;
	font-family: var(--font-monospace, monospace);
	font-size: 11px;
	white-space: pre-wrap;
	word-break: break-word;
}

.event-inspector__empty {
	color: var(--text-muted);
	text-align: center;
	padding-top: 16px;
}
</style>
