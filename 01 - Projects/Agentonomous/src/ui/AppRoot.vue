<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import PanelLayout from './layouts/PanelLayout.vue';
import DashboardLayout from './layouts/DashboardLayout.vue';

const route = useRoute();

const layouts = {
	main: MainLayout,
	panel: PanelLayout,
	dashboard: DashboardLayout,
} as const;

type LayoutName = keyof typeof layouts;

const LayoutComponent = computed(() => {
	const name = (route.meta?.layout as LayoutName | undefined) ?? 'main';
	return layouts[name] ?? MainLayout;
});
</script>

<template>
	<component :is="LayoutComponent">
		<router-view />
	</component>
</template>
