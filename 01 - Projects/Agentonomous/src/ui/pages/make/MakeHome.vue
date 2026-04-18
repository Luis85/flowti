<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';

const store = useMakeStore();
const { typesLoading, types, favoriteTypes } = storeToRefs(store);

onMounted(() => { void store.loadTypes(); });
</script>

<template>
	<div class="make-home">
		<h1 data-testid="make-home-title">Make</h1>
		<p data-testid="make-home-blurb">Author structured content in your vault.</p>

		<div v-if="typesLoading" data-testid="make-home-spinner" class="make-home__spinner">Loading…</div>

		<router-link
			v-else-if="types.length > 0"
			data-testid="browse-types-cta"
			to="/make/types"
			class="make-home__cta"
		>
			Browse types
		</router-link>

		<p v-else data-testid="make-home-empty" class="make-home__empty">
			You haven't created any types yet. Type authoring comes in a later update.
		</p>

		<section v-if="favoriteTypes.length > 0" class="make-home__favorites">
			<h2 data-testid="make-home-favorites-heading">Favorites</h2>
			<ul class="make-home__chips">
				<li v-for="t in favoriteTypes" :key="t.id">
					<router-link
						:data-testid="`favorite-chip-${t.id}`"
						:to="`/make/types/${t.id}`"
						class="make-home__chip"
					>
						{{ t.name }}
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
.make-home__empty { color: var(--text-muted); }
.make-home__favorites h2 { font-size: 0.875rem; color: var(--text-muted); margin: 0 0 0.5rem 0; }
.make-home__chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
.make-home__chip { display: inline-block; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; font-size: 0.75rem; color: var(--text-normal); text-decoration: none; }
</style>
