<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';

const { pluginVersion } = storeToRefs(useAppStore());
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--dashboard">
		<header class="dashboard-header" data-testid="dashboard-header">
			<h1>Agentonomous</h1>
			<span data-testid="dashboard-version">v{{ pluginVersion }}</span>
		</header>
		<aside class="dashboard-sidebar" data-testid="dashboard-sidebar">
			<nav>
				<router-link data-testid="nav-home" to="/">Home</router-link>
				<router-link data-testid="nav-dashboard" to="/dashboard">Dashboard</router-link>
				<router-link data-testid="nav-about" to="/about">About</router-link>
			</nav>
		</aside>
		<main class="dashboard-main" data-testid="dashboard-main">
			<slot />
		</main>
	</div>
</template>

<style scoped>
.agentonomous-layout--dashboard {
	display: grid;
	grid-template-columns: 200px 1fr;
	grid-template-rows: auto 1fr;
	grid-template-areas:
		"header header"
		"sidebar main";
	height: 100%;
	color: var(--text-normal);
}

.dashboard-header {
	grid-area: header;
	padding: 1rem;
	border-bottom: 1px solid var(--background-modifier-border);
}

.dashboard-sidebar {
	grid-area: sidebar;
	padding: 1rem;
	border-right: 1px solid var(--background-modifier-border);
	overflow-y: auto;
}

.dashboard-main {
	grid-area: main;
	padding: 1rem;
	overflow-y: auto;
}
</style>
