import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
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
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('renders header slot', async () => {
			await expect(canvas.getByTestId('panel-header')).toBeVisible();
			await expect(canvas.getByTestId('panel-header')).toHaveTextContent('Panel Title');
		});

		await step('renders default slot content', async () => {
			await expect(canvas.getByTestId('panel-content')).toHaveTextContent('Panel content goes here.');
		});
	},
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
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('hides header when slot is empty', async () => {
			await expect(canvas.queryByTestId('panel-header')).toBeNull();
		});

		await step('still renders panel content', async () => {
			await expect(canvas.getByTestId('panel-content')).toHaveTextContent('Panel content without a header.');
		});
	},
};
