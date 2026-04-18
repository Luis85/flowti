import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import Home from '../../src/ui/pages/Home.vue';

const meta: Meta<typeof Home> = {
	title: 'Pages/Home',
	component: Home,
};
export default meta;

type Story = StoryObj<typeof Home>;

export const Default: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Home page rendered in isolation with a fresh Pinia. Greeting, version badge, and the About nav link are all driven by the default `useAppStore()` state.',
			},
		},
	},
};

export const RendersGreeting: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows greeting with app name', async () => {
			await expect(canvas.getByTestId('greeting')).toHaveTextContent(/Agentonomous/);
		});

		await step('shows version string', async () => {
			await expect(canvas.getByTestId('version')).toBeVisible();
		});

		await step('nav link to About is rendered and targets /about', async () => {
			// Home.vue has no <router-view>, so clicking the link navigates but
			// can't render the target.  Verifying the `to` attribute via href
			// exercises the real wiring without needing a host with <router-view>.
			const link = canvas.getByTestId('nav-about');
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', '/about');
		});
	},
};
