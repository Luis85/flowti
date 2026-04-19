<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
import KpiCard from '../../components/make/KpiCard.vue';
import RecentInstancesList from '../../components/make/RecentInstancesList.vue';

const { t } = useI18n();
const store = useMakeStore();
const { typesLoading, types, favoriteTypes, kpis, kpisLoading } = storeToRefs(store);

onMounted(() => {
	void store.loadTypes();
	void store.loadKpis();
});

const hasTypes = computed<boolean>(() => types.value.length > 0);

const typeNamesById = computed<Record<string, string>>(() => {
	const out: Record<string, string> = {};
	for (const t2 of types.value) out[t2.id] = t2.name;
	return out;
});

function onOpenInstance(path: string): void {
	void store.openInstance(path, 'tab');
}
</script>

<template>
	<div class="make-home">
		<header class="make-home__header">
			<h1 data-testid="make-home-title">{{ t('make.home.title') }}</h1>
			<div v-if="hasTypes" class="make-home__header-actions">
				<router-link
					data-testid="make-home-browse-cta"
					to="/make/types"
					class="make-home__cta make-home__cta--secondary"
				>
					{{ t('make.home.browseTypesCta') }}
				</router-link>
				<router-link
					data-testid="make-home-create-cta-populated"
					to="/make/types/new"
					class="make-home__cta"
				>
					{{ t('make.type.create.cta') }}
				</router-link>
			</div>
		</header>

		<p data-testid="make-home-blurb" class="make-home__blurb">{{ t('make.home.blurb') }}</p>

		<div v-if="typesLoading" data-testid="make-home-spinner" class="make-home__spinner">Loading…</div>

		<div v-else-if="!hasTypes" class="make-home__empty">
			<p data-testid="make-home-empty">{{ t('make.home.empty') }}</p>
			<router-link
				data-testid="make-home-create-cta-empty"
				to="/make/types/new"
				class="make-home__cta"
			>
				{{ t('make.type.create.cta') }}
			</router-link>
		</div>

		<template v-else>
			<section class="make-home__kpis" role="group" :aria-label="t('make.home.title')">
				<KpiCard :label="t('make.home.kpi.types')"           :value="kpis?.typesCount ?? 0"     testid="kpi-types"     :loading="kpis === null" />
				<KpiCard :label="t('make.home.kpi.instances')"       :value="kpis?.instancesCount ?? 0" testid="kpi-instances" :loading="kpis === null" />
				<KpiCard :label="t('make.home.kpi.createdThisWeek')" :value="kpis?.createdThisWeek ?? 0" testid="kpi-week"      :loading="kpis === null" />
			</section>

			<section class="make-home__recent">
				<h2 data-testid="make-home-recent-heading" class="make-home__section-heading">{{ t('make.home.recent.heading') }}</h2>
				<RecentInstancesList
					:instances="kpis?.recentlyCreated ?? []"
					:type-names-by-id="typeNamesById"
					:empty-placeholder="t('make.home.recent.empty')"
					:loading="kpisLoading"
					@open="onOpenInstance"
				/>
			</section>

			<section v-if="favoriteTypes.length > 0" class="make-home__favorites">
				<h2 data-testid="make-home-favorites-heading" class="make-home__section-heading">{{ t('make.home.favoritesHeading') }}</h2>
				<ul class="make-home__chips">
					<li v-for="t2 in favoriteTypes" :key="t2.id">
						<router-link
							:data-testid="`favorite-chip-${t2.id}`"
							:to="`/make/types/${t2.id}`"
							class="make-home__chip"
						>
							{{ t2.name }}
						</router-link>
					</li>
				</ul>
			</section>
		</template>
	</div>
</template>

<style scoped>
.make-home { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 1rem; }
.make-home__header { display: flex; justify-content: space-between; align-items: center; }
.make-home__header h1 { margin: 0; font-size: 1.25rem; }
.make-home__header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.make-home__blurb { color: var(--text-muted); margin: 0; }
.make-home__spinner { color: var(--text-muted); }
.make-home__cta { display: inline-block; padding: 0.375rem 0.75rem; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; text-decoration: none; font-size: 0.875rem; }
.make-home__cta--secondary { background: var(--interactive-normal); color: var(--text-normal); }
.make-home__empty { color: var(--text-muted); display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.make-home__empty p { margin: 0; }
.make-home__kpis { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.make-home__section-heading { font-size: 0.875rem; color: var(--text-muted); margin: 0 0 0.5rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
.make-home__chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
.make-home__chip { display: inline-block; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; font-size: 0.75rem; color: var(--text-normal); text-decoration: none; }
</style>
