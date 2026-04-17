import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within, userEvent } from 'storybook/test';
import About from '../../src/ui/pages/About.vue';

const meta: Meta<typeof About> = {
	title: 'Pages/About',
	component: About,
};
export default meta;

type Story = StoryObj<typeof About>;

export const Default: Story = {};

export const RendersTitle: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows app title', async () => {
			await expect(canvas.getByTestId('about-title')).toHaveTextContent('Agentonomous');
		});

		await step('shows version info', async () => {
			await expect(canvas.getByTestId('about-version')).toBeVisible();
		});

		await step('has navigation link to Home', async () => {
			await expect(canvas.getByTestId('nav-home')).toBeVisible();
		});
	},
};

export const NavigateToHome: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('click Home link', async () => {
			const homeLink = canvas.getByTestId('nav-home');
			await userEvent.click(homeLink);
		});
	},
};
