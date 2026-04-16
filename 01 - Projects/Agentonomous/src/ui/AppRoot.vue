<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import PanelLayout from './layouts/PanelLayout.vue';
import DashboardLayout from './layouts/DashboardLayout.vue';

const route = useRoute();

const layouts: Record<string, Component> = {
	main: MainLayout,
	panel: PanelLayout,
	dashboard: DashboardLayout,
};

const LayoutComponent = computed<Component>(() => {
	const name = route.meta.layout as string | undefined;
	if (name !== undefined && name in layouts) {
		return layouts[name] as Component;
	}
	return MainLayout;
});
</script>

<template>
	<component :is="LayoutComponent">
		<router-view />
	</component>
</template>
