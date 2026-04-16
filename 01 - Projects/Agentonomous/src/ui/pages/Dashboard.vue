<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useModuleStatusStore } from '../stores/module-status-store.js';

const statusStore = useModuleStatusStore();
const { modules } = storeToRefs(statusStore);
</script>

<template>
	<div class="dashboard-cards" data-testid="module-cards">
		<div
			v-for="mod in modules"
			:key="mod.id"
			class="module-card"
			:data-testid="`module-card-${mod.id}`"
		>
			<span data-testid="module-name">{{ mod.name }}</span>
			<span
				data-testid="module-status"
				:class="{
					'module-card__status--ready': mod.status === 'ready',
					'module-card__status--degraded': mod.status === 'degraded',
				}"
			>{{ mod.status }}</span>
		</div>
	</div>
</template>
