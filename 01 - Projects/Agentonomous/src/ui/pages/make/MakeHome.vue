<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';

const { t } = useI18n();
const store = useMakeStore();
const { typesLoading, types, favoriteTypes } = storeToRefs(store);

onMounted(() => { void store.loadTypes(); });
</script>

<template>
	<div class="make-home">
		<h1 data-testid="make-home-title">{{ t('make.home.title') }}</h1>
		<p data-testid="make-home-blurb">{{ t('make.home.blurb') }}</p>

		<div v-if="typesLoading" data-testid="make-home-spinner" class="make-home__spinner">Loading…</div>

		<div v-else-if="types.length > 0" class="make-home__actions">
			<router-link
				data-testid="make-home-browse-cta"
				to="/make/types"
				class="make-home__cta"
			>
				{{ t('make.home.browseTypesCta') }}
			</router-link>
			<router-link
				data-testid="make-home-create-cta-populated"
				to="/make/types/new"
				class="make-home__cta make-home__cta--secondary"
			>
				{{ t('make.type.create.cta') }}
			</router-link>
		</div>

		<div v-else class="make-home__empty">
			<p data-testid="make-home-empty">{{ t('make.home.empty') }}</p>
			<router-link
				data-testid="make-home-create-cta-empty"
				to="/make/types/new"
				class="make-home__cta"
			>
				{{ t('make.type.create.cta') }}
			</router-link>
		</div>

		<section v-if="favoriteTypes.length > 0" class="make-home__favorites">
			<h2 data-testid="make-home-favorites-heading">{{ t('make.home.favoritesHeading') }}</h2>
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
	</div>
</template>

<style scoped>
.make-home { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 1rem; }
.make-home__spinner { color: var(--text-muted); }
.make-home__cta { display: inline-block; padding: 0.5rem 1rem; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; text-decoration: none; align-self: flex-start; }
.make-home__cta--secondary { background: var(--interactive-normal); color: var(--text-normal); }
.make-home__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.make-home__empty { color: var(--text-muted); display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.make-home__empty p { margin: 0; }
.make-home__favorites h2 { font-size: 0.875rem; color: var(--text-muted); margin: 0 0 0.5rem 0; }
.make-home__chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
.make-home__chip { display: inline-block; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; font-size: 0.75rem; color: var(--text-normal); text-decoration: none; }
</style>
