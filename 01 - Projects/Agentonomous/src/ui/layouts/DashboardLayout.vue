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
