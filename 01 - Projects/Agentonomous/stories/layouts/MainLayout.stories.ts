import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MainLayout from '../../src/ui/layouts/MainLayout.vue';

const meta: Meta<typeof MainLayout> = {
	title: 'Layouts/MainLayout',
	component: MainLayout,
};
export default meta;

type Story = StoryObj<typeof MainLayout>;

export const Default: Story = {
	render: () => ({
		components: { MainLayout },
		template: `
			<MainLayout>
				<template #header><h2>Page Header</h2></template>
				<div>Main Content Area</div>
			</MainLayout>
		`,
	}),
};

export const NoHeader: Story = {
	render: () => ({
		components: { MainLayout },
		template: `
			<MainLayout>
				<div>Content without a header slot</div>
			</MainLayout>
		`,
	}),
};
