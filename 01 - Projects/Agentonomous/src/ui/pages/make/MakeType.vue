<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
import MakeTypeFields from './MakeTypeFields.vue';
import MakeTypeInstances from './MakeTypeInstances.vue';
import { getMakeSettings } from '../../../modules/make/make-module.js';

type Tab = 'fields' | 'instances';

const route = useRoute();
const router = useRouter();
const store = useMakeStore();
const { instancesByTypeId, instancesLoading, instancesError, typesLoading } = storeToRefs(store);

const typeId = computed(() => String(route.params['typeId']));
const type = computed(() => store.getType(typeId.value));

const activeTab = ref<Tab>(route.hash === '#fields' ? 'fields' : 'instances');

watch(() => route.hash, (hash) => {
	activeTab.value = hash === '#fields' ? 'fields' : 'instances';
});
watch(activeTab, (next) => {
	const wantedHash = `#${next}`;
	if (route.hash !== wantedHash) void router.replace({ hash: wantedHash });
});

onMounted(async () => {
	if (!store.typesLoaded) await store.loadTypes();
	if (type.value !== undefined) await store.loadInstances(type.value.id);
});

function isFavorite(id: string): boolean {
	return getMakeSettings()?.favorites.includes(id) ?? false;
}

function onRefresh(): void {
	if (type.value !== undefined) void store.refreshAll(type.value.id);
}

const instances = computed(() => type.value ? instancesByTypeId.value.get(type.value.id) : undefined);
const loadingInstances = computed(() => type.value ? instancesLoading.value.has(type.value.id) : false);
const errorInstances = computed(() => type.value ? (instancesError.value.get(type.value.id) ?? null) : null);
</script>

<template>
	<div v-if="type" class="make-type">
		<header class="make-type__header">
			<div class="make-type__title-row">
				<h1 data-testid="make-type-title">{{ type.name }}</h1>
				<span v-if="isFavorite(type.id)" :data-testid="`favorite-star-${type.id}`" class="star">★</span>
				<button
					type="button"
					data-testid="make-type-refresh"
					:disabled="typesLoading || instancesLoading.size > 0"
					@click="onRefresh"
				>
					Refresh
				</button>
			</div>
			<p data-testid="make-type-folder" class="folder">Folder: {{ type.instancesFolder }}</p>
		</header>

		<div role="tablist" class="tabs">
			<button
				type="button"
				role="tab"
				data-testid="make-type-tab-fields"
				:aria-selected="activeTab === 'fields'"
				:class="{ active: activeTab === 'fields' }"
				@click="activeTab = 'fields'"
			>
				Fields
			</button>
			<button
				type="button"
				role="tab"
				data-testid="make-type-tab-instances"
				:aria-selected="activeTab === 'instances'"
				:class="{ active: activeTab === 'instances' }"
				@click="activeTab = 'instances'"
			>
				Instances
			</button>
		</div>

		<MakeTypeFields v-if="activeTab === 'fields'" :type="type" />
		<MakeTypeInstances
			v-else
			:type="type"
			:instances="instances"
			:loading="loadingInstances"
			:error="errorInstances"
		/>
	</div>
</template>

<style scoped>
.make-type { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 0.5rem; }
.make-type__header { display: flex; flex-direction: column; gap: 0.25rem; }
.make-type__title-row { display: flex; align-items: center; gap: 0.75rem; }
.make-type__title-row h1 { margin: 0; }
.star { color: var(--text-accent); }
.folder { color: var(--text-muted); font-size: 0.875rem; margin: 0; }
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--background-modifier-border); }
.tabs button { background: none; border: none; padding: 0.5rem 0.75rem; color: var(--text-muted); border-bottom: 2px solid transparent; cursor: pointer; }
.tabs button.active { color: var(--text-normal); border-bottom-color: var(--interactive-accent); }
</style>
