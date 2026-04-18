<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
import type { MakeSettings } from '../../../modules/make/make-settings.js';
import { getMakeSettings } from '../../../modules/make/make-module.js';

const store = useMakeStore();
const { typesLoading, typesError, typesSortedByName, instanceCountByTypeId, instancesLoading } = storeToRefs(store);

onMounted(async () => {
	await store.loadTypes();
	void store.loadInstancesForAll();
});

function settings(): MakeSettings | null { return getMakeSettings(); }
function isFavorite(typeId: string): boolean {
	return settings()?.favorites.includes(typeId) ?? false;
}
function countLabel(typeId: string): string {
	const n = instanceCountByTypeId.value.get(typeId);
	if (n === undefined) return '— instances';
	return n === 1 ? '1 instance' : `${n} instances`;
}
async function onRefresh(): Promise<void> {
	await store.refreshAll();
	await store.loadInstancesForAll();
}
</script>

<template>
	<div class="make-types">
		<header class="make-types__header">
			<div class="make-types__title-block">
				<h1 data-testid="make-types-title">Types</h1>
				<span data-testid="make-types-count" class="make-types__count-label">
					{{ typesSortedByName.length === 1 ? '1 type' : `${typesSortedByName.length} types` }}
				</span>
			</div>
			<button
				type="button"
				data-testid="make-types-refresh"
				:disabled="typesLoading || instancesLoading.size > 0"
				@click="onRefresh"
			>
				Refresh
			</button>
		</header>

		<div v-if="typesError" data-testid="make-types-error" class="make-types__error" role="alert">
			{{ typesError }}
			<button type="button" data-testid="make-types-retry" @click="onRefresh">Retry</button>
		</div>

		<p v-else-if="typesLoading && typesSortedByName.length === 0" class="make-types__loading">Loading…</p>

		<p v-else-if="typesSortedByName.length === 0" data-testid="make-types-empty" class="make-types__empty">
			No types yet.
		</p>

		<ul v-else class="make-types__list">
			<li v-for="t in typesSortedByName" :key="t.id" class="make-types__row">
				<router-link :to="`/make/types/${t.id}`" :data-testid="`type-row-${t.id}`" class="make-types__link">
					<span v-if="isFavorite(t.id)" :data-testid="`favorite-star-${t.id}`" class="make-types__star" aria-label="favorite">★</span>
					<span class="make-types__name">{{ t.name }}</span>
					<span v-if="t.description" class="make-types__description">{{ t.description }}</span>
					<span class="make-types__count">{{ countLabel(t.id) }}</span>
				</router-link>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.make-types { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 1rem; }
.make-types__header { display: flex; justify-content: space-between; align-items: center; }
.make-types__header h1 { margin: 0; }
.make-types__title-block { display: flex; align-items: baseline; gap: 0.5rem; }
.make-types__count-label { color: var(--text-muted); font-size: 0.875rem; }
.make-types__error { padding: 0.5rem 0.75rem; border: 1px solid var(--text-error); color: var(--text-error); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.make-types__loading,
.make-types__empty { color: var(--text-muted); }
.make-types__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.make-types__row { border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.make-types__link {
	display: grid;
	grid-template-columns: auto 1fr auto;
	grid-template-rows: auto auto;
	grid-template-areas:
		'star name count'
		'.    desc desc';
	gap: 0.25rem 0.5rem;
	padding: 0.5rem 0.75rem;
	text-decoration: none;
	color: inherit;
	align-items: center;
}
.make-types__star { grid-area: star; color: var(--text-accent); }
.make-types__name { grid-area: name; font-weight: 600; }
.make-types__description { grid-area: desc; color: var(--text-muted); font-size: 0.875rem; }
.make-types__count { grid-area: count; color: var(--text-muted); font-size: 0.875rem; white-space: nowrap; }
</style>
