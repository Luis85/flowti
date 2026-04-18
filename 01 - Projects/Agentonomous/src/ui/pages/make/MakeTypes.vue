<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
const { t } = useI18n();
const store = useMakeStore();
const { typesLoading, typesError, typesSortedByName, instanceCountByTypeId, instancesLoading } = storeToRefs(store);

onMounted(async () => {
	await store.loadTypes();
	void store.loadInstancesForAll();
});

function countLabel(typeId: string): string {
	const n = instanceCountByTypeId.value.get(typeId);
	if (n === undefined) return '— instances';
	return n === 1 ? t('make.types.instancesCountOne', { count: 1 }) : t('make.types.instancesCountOther', { count: n });
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
				<h1 data-testid="make-types-title">{{ t('make.types.title') }}</h1>
				<span data-testid="make-types-count" class="make-types__count-label">
					{{ typesSortedByName.length === 1 ? t('make.types.countOne', { count: 1 }) : t('make.types.countOther', { count: typesSortedByName.length }) }}
				</span>
			</div>
			<div class="make-types__header-actions">
				<router-link
					data-testid="make-types-create-cta"
					to="/make/types/new"
					class="make-types__create-cta"
				>
					{{ t('make.type.create.cta') }}
				</router-link>
				<button
					type="button"
					data-testid="make-types-refresh"
					:disabled="typesLoading || instancesLoading.size > 0"
					@click="onRefresh"
				>
					{{ t('make.types.refresh') }}
				</button>
			</div>
		</header>

		<div v-if="typesError" data-testid="make-types-error" class="make-types__error" role="alert">
			{{ typesError }}
			<button type="button" data-testid="make-types-retry" @click="onRefresh">Retry</button>
		</div>

		<p v-else-if="typesLoading && typesSortedByName.length === 0" class="make-types__loading">Loading…</p>

		<p v-else-if="typesSortedByName.length === 0" data-testid="make-types-empty" class="make-types__empty">
			{{ t('make.types.empty') }}
		</p>

		<ul v-else class="make-types__list">
			<li v-for="type in typesSortedByName" :key="type.id" class="make-types__row">
				<router-link :to="`/make/types/${type.id}`" :data-testid="`type-row-${type.id}`" class="make-types__link">
					<button
						type="button"
						:data-testid="`favorite-star-${type.id}`"
						:aria-label="store.isFavoritedForUI(type.id) ? t('make.type.favoriteRemove', { name: type.name }) : t('make.type.favoriteAdd', { name: type.name })"
						:aria-pressed="store.isFavoritedForUI(type.id) ? 'true' : 'false'"
						:aria-busy="store.favoriteToggling.has(type.id) ? 'true' : 'false'"
						class="favorite-star"
						:class="{ filled: store.isFavoritedForUI(type.id), pending: store.favoriteToggling.has(type.id) }"
						@click.prevent.stop="store.toggleFavorite(type.id)"
					>★</button>
					<span class="make-types__name">{{ type.name }}</span>
					<span v-if="type.description" class="make-types__description">{{ type.description }}</span>
					<span class="make-types__count">{{ countLabel(type.id) }}</span>
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
.make-types__header-actions { display: flex; align-items: center; gap: 0.5rem; }
.make-types__create-cta { display: inline-block; padding: 0.375rem 0.75rem; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; text-decoration: none; font-size: 0.875rem; }
.favorite-star { grid-area: star; background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); font-size: 1rem; line-height: 1; }
.favorite-star.filled { color: var(--text-accent); }
.favorite-star.pending { opacity: 0.5; }
.make-types__name { grid-area: name; font-weight: 600; }
.make-types__description { grid-area: desc; color: var(--text-muted); font-size: 0.875rem; }
.make-types__count { grid-area: count; color: var(--text-muted); font-size: 0.875rem; white-space: nowrap; }
</style>
