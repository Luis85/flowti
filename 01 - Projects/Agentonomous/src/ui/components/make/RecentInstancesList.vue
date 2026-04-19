<script setup lang="ts">
import type { InstanceRef } from '../../../domain/make/types.js';
import { formatRelativeDate } from '../../pages/make/format-relative-date.js';

const props = defineProps<{
	instances:         readonly InstanceRef[];
	typeNamesById:     Readonly<Record<string, string>>;
	emptyPlaceholder:  string;
	loading:           boolean;
}>();

const emit = defineEmits<{ open: [path: string] }>();

function typeChip(typeId: string): string {
	return props.typeNamesById[typeId] ?? typeId;
}

function onRowClick(path: string): void {
	emit('open', path);
}

function onRowKeydown(e: KeyboardEvent, path: string): void {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		emit('open', path);
	}
}
</script>

<template>
	<ul v-if="instances.length > 0" role="list" class="recent-instances">
		<li v-for="r in instances" :key="r.path" class="recent-instance">
			<div
				:data-testid="`recent-instance-row-${r.path}`"
				role="button"
				tabindex="0"
				:aria-label="`Open ${r.title}`"
				class="recent-instance__row"
				@click="onRowClick(r.path)"
				@keydown="(e: KeyboardEvent) => onRowKeydown(e, r.path)"
			>
				<span class="recent-instance__title">{{ r.title }}</span>
				<span class="recent-instance__chip">{{ typeChip(r.typeId) }}</span>
				<span class="recent-instance__date">{{ formatRelativeDate(r.createdAt) }}</span>
			</div>
		</li>
	</ul>
	<p
		v-else-if="!loading && emptyPlaceholder.length > 0"
		data-testid="recent-instances-empty"
		class="recent-instances__empty"
	>
		{{ emptyPlaceholder }}
	</p>
</template>

<style scoped>
.recent-instances { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.recent-instance { margin: 0; }
.recent-instance__row { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: pointer; outline: none; }
.recent-instance__row:hover { background: var(--background-modifier-hover); }
.recent-instance__row:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }
.recent-instance__title { flex: 1; font-weight: 500; }
.recent-instance__chip { font-size: 0.75rem; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; color: var(--text-muted); }
.recent-instance__date { color: var(--text-muted); font-size: 0.875rem; min-width: 4rem; text-align: right; }
.recent-instances__empty { color: var(--text-muted); margin: 0; font-style: italic; }
</style>
