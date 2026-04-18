import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import About from '../../src/ui/pages/About.vue';

const meta: Meta<typeof About> = {
	title: 'Pages/About',
	component: About,
};
export default meta;

type Story = StoryObj<typeof About>;

export const Default: Story = {
	parameters: {
		docs: {
			description: {
				story: 'About page rendered in isolation with a fresh Pinia. Title, version, and the Home nav link are pulled from the default `useAppStore()` state.',
			},
		},
	},
};

export const RendersTitle: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows app title', async () => {
			await expect(canvas.getByTestId('about-title')).toHaveTextContent('Agentonomous');
		});

		await step('shows version info', async () => {
			await expect(canvas.getByTestId('about-version')).toBeVisible();
		});

		await step('nav link to Home is rendered and targets /', async () => {
			// See Home.stories for why we assert href instead of click-and-observe.
			const link = canvas.getByTestId('nav-home');
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', '/');
		});
	},
};
