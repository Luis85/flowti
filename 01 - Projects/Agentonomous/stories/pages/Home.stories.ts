import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within, userEvent } from 'storybook/test';
import Home from '../../src/ui/pages/Home.vue';

const meta: Meta<typeof Home> = {
	title: 'Pages/Home',
	component: Home,
};
export default meta;

type Story = StoryObj<typeof Home>;

export const Default: Story = {};

export const RendersGreeting: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows greeting with app name', async () => {
			await expect(canvas.getByTestId('greeting')).toHaveTextContent(/Agentonomous/);
		});

		await step('shows version string', async () => {
			await expect(canvas.getByTestId('version')).toBeVisible();
		});

		await step('has navigation link to About', async () => {
			await expect(canvas.getByTestId('nav-about')).toBeVisible();
		});
	},
};

export const NavigateToAbout: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('click About link', async () => {
			const aboutLink = canvas.getByTestId('nav-about');
			await userEvent.click(aboutLink);
		});
	},
};
