import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import Dashboard from '../../src/ui/pages/Dashboard.vue';
import { useModuleStatusStore } from '../../src/ui/stores/module-status-store.js';

const withModules: Decorator = () => ({
	setup() {
		const store = useModuleStatusStore();
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'event-inspector', name: 'Event Inspector', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);
		return {};
	},
	template: '<story />',
});

const meta: Meta<typeof Dashboard> = {
	title: 'Pages/Dashboard',
	component: Dashboard,
};
export default meta;

type Story = StoryObj<typeof Dashboard>;

export const Empty: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Dashboard with no modules registered — exercises the empty-state fallback when `useModuleStatusStore()` has no entries.',
			},
		},
	},
};

export const WithModules: Story = {
	decorators: [withModules],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('renders module cards container', async () => {
			await expect(canvas.getByTestId('module-cards')).toBeVisible();
		});

		await step('renders all three module cards', async () => {
			const cards = canvas.getAllByTestId(/^module-card-/);
			await expect(cards).toHaveLength(3);
		});

		await step('displays correct module names', async () => {
			await expect(canvas.getByTestId('module-card-core')).toHaveTextContent('Core');
			await expect(canvas.getByTestId('module-card-event-inspector')).toHaveTextContent('Event Inspector');
			await expect(canvas.getByTestId('module-card-broken')).toHaveTextContent('Broken');
		});

		await step('shows degraded status for broken module', async () => {
			const brokenCard = canvas.getByTestId('module-card-broken');
			const status = within(brokenCard).getByTestId('module-status');
			await expect(status).toHaveTextContent('degraded');
		});
	},
};
