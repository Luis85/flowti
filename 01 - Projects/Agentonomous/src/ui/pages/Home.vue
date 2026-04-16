<script setup lang="ts">
import { storeToRefs } from 'pinia';
import HelloCard from '../components/HelloCard.vue';
import { useAppStore } from '../stores/app-store.js';

const appStore = useAppStore();
const { greeting, pluginVersion } = storeToRefs(appStore);
</script>

<template>
	<div class="agentonomous-home">
		<HelloCard data-testid="greeting" :title="greeting" :message="`Version ${pluginVersion}`" />
		<p data-testid="version">{{ pluginVersion }}</p>
		<nav class="agentonomous-nav">
			<router-link data-testid="nav-about" to="/about">About</router-link>
		</nav>
	</div>
</template>
