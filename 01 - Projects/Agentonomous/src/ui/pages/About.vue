<script setup lang="ts">
import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';
import { PluginContextKey } from '../plugin-context-key.js';

const appStore = useAppStore();
const { pluginVersion } = storeToRefs(appStore);
const _ctx = inject(PluginContextKey);
</script>

<template>
	<div class="agentonomous-about">
		<h2 data-testid="about-title">Agentonomous</h2>
		<p data-testid="about-version">Autonomous agents sandbox — version {{ pluginVersion }}.</p>
		<nav class="agentonomous-nav">
			<router-link data-testid="nav-home" to="/">Home</router-link>
		</nav>
	</div>
</template>
