<script setup lang="ts">
import { storeToRefs } from 'pinia';
import HelloCard from '../components/HelloCard.vue';
import { useAppStore } from '../stores/app-store.js';

const appStore = useAppStore();
const { greeting, pluginVersion } = storeToRefs(appStore);
</script>

<template>
	<div class="agentonomous-home">
		<HelloCard :title="greeting" :message="`Version ${pluginVersion}`" />
		<nav class="agentonomous-nav">
			<router-link to="/about">About</router-link>
		</nav>
	</div>
</template>
