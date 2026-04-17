<script setup lang="ts">
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--panel">
		<header v-if="$slots.header" class="panel-header" data-testid="panel-header">
			<slot name="header" />
		</header>
		<div class="panel-content" data-testid="panel-content">
			<slot />
		</div>
	</div>
</template>

<style scoped>
.agentonomous-layout--panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	color: var(--text-normal);
}

.panel-header {
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--background-modifier-border);
	font-weight: 600;
}

.panel-content {
	flex: 1;
	overflow-y: auto;
	padding: 0.75rem 1rem;
}
</style>
