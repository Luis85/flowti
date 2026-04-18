<script setup lang="ts">
import { computed } from 'vue';
import type { InstanceRef } from '../../../domain/make/types.js';
import type { TypeSchema } from '../../../domain/make/type-schema.js';

const props = defineProps<{
	type: TypeSchema;
	instances: readonly InstanceRef[] | undefined;
	loading: boolean;
	error: string | null;
}>();

const sorted = computed(() => {
	const list = props.instances ?? [];
	return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

function shortDate(iso: string): string {
	return iso.slice(0, 10);
}
</script>

<template>
	<div class="make-type-instances">
		<p v-if="loading" data-testid="make-type-instances-loading" class="loading">Loading…</p>
		<p v-else-if="error" data-testid="make-type-instances-error" class="error">{{ error }}</p>
		<p v-else-if="sorted.length === 0" data-testid="make-type-instances-empty" class="empty">
			No {{ type.name }} instances yet. Instance creation comes in a later update.
		</p>
		<ul v-else class="instances-list">
			<li v-for="ref in sorted" :key="ref.path" :data-testid="`instance-row-${ref.path}`" class="instance-row">
				<span class="instance-title">{{ ref.title }}</span>
				<span class="instance-date">created {{ shortDate(ref.createdAt) }}</span>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.make-type-instances { padding: 0.5rem 0; }
.loading,
.empty { color: var(--text-muted); }
.error { color: var(--text-error); }
.instances-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.instance-row { display: flex; justify-content: space-between; padding: 0.375rem 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.instance-title { font-weight: 500; }
.instance-date { color: var(--text-muted); font-size: 0.875rem; }
</style>
