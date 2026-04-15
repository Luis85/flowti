<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';

const appStore = useAppStore();
const { pluginVersion } = storeToRefs(appStore);
</script>

<template>
	<div class="agentonomous-about">
		<h2>Agentonomous</h2>
		<p>Autonomous agents sandbox — version {{ pluginVersion }} for Obsidian 1.12.7+.</p>
		<nav class="agentonomous-nav">
			<router-link to="/">Home</router-link>
		</nav>
	</div>
</template>
