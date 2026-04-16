import type { Meta, StoryObj } from '@storybook/vue3-vite';
import PanelLayout from '../../src/ui/layouts/PanelLayout.vue';

const meta: Meta<typeof PanelLayout> = {
	title: 'Layouts/PanelLayout',
	component: PanelLayout,
};
export default meta;

type Story = StoryObj<typeof PanelLayout>;

export const Default: Story = {
	render: () => ({
		components: { PanelLayout },
		template: `
			<PanelLayout>
				<template #header>Panel Title</template>
				<div>Panel content goes here.</div>
			</PanelLayout>
		`,
	}),
};

export const NoHeader: Story = {
	render: () => ({
		components: { PanelLayout },
		template: `
			<PanelLayout>
				<div>Panel content without a header.</div>
			</PanelLayout>
		`,
	}),
};
