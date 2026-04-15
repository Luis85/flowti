<script setup lang="ts">
interface Props {
	title: string;
	message: string;
}
defineProps<Props>();
</script>

<template>
	<section class="hello-card">
		<h2 class="hello-card__title">{{ title }}</h2>
		<p class="hello-card__message">{{ message }}</p>
	</section>
</template>
