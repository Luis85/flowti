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
