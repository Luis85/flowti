import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
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
				<div data-testid="main-content">Main Content Area</div>
			</MainLayout>
		`,
	}),
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('renders header slot', async () => {
			await expect(canvas.getByTestId('layout-header')).toBeVisible();
			await expect(canvas.getByTestId('layout-header')).toHaveTextContent('Page Header');
		});

		await step('renders default slot content', async () => {
			await expect(canvas.getByTestId('layout-content')).toHaveTextContent('Main Content Area');
		});
	},
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
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('hides header when slot is empty', async () => {
			await expect(canvas.queryByTestId('layout-header')).toBeNull();
		});

		await step('still renders main content', async () => {
			await expect(canvas.getByTestId('layout-content')).toHaveTextContent('Content without a header slot');
		});
	},
};
