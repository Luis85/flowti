<script setup lang="ts">
interface Props {
	title: string;
	message: string;
}
defineProps<Props>();
</script>

<template>
	<section class="hello-card">
		<h2 class="hello-card__title" data-testid="card-title">{{ title }}</h2>
		<p class="hello-card__message" data-testid="card-message">{{ message }}</p>
	</section>
</template>

<style scoped>
.hello-card {
	border: 1px solid var(--background-modifier-border);
	border-radius: 0.5rem;
	padding: 1rem;
	background: var(--background-secondary);
}

.hello-card__title {
	margin: 0 0 0.5rem 0;
	font-size: 1.25rem;
}

.hello-card__message {
	margin: 0;
	color: var(--text-muted);
}
</style>
