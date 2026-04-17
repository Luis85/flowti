<script setup lang="ts">
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--main">
		<header v-if="$slots.header" class="layout-header" data-testid="layout-header">
			<slot name="header" />
		</header>
		<main class="layout-content" data-testid="layout-content">
			<slot />
		</main>
	</div>
</template>

<style scoped>
.agentonomous-layout--main {
	display: flex;
	flex-direction: column;
	padding: 1rem;
	height: 100%;
	color: var(--text-normal);
}

.layout-header {
	margin-bottom: 1rem;
}
</style>
