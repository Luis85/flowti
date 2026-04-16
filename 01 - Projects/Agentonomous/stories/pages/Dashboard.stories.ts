import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import { expect } from 'vitest';
import Dashboard from '../../src/ui/pages/Dashboard.vue';
import { DashboardPage } from '../../src/ui/pages/Dashboard.po.js';
import { useModuleStatusStore } from '../../src/ui/stores/module-status-store.js';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof Dashboard> = {
	title: 'Pages/Dashboard',
	component: Dashboard,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof Dashboard>;

export const Empty: Story = {
	render: () => ({
		components: { Dashboard },
		template: '<Dashboard />',
		global: { plugins: [createPinia()] },
	}),
};

export const WithModules: Story = {
	render: () => {
		const pinia = createPinia();
		const store = useModuleStatusStore(pinia);
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'event-inspector', name: 'Event Inspector', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);
		return {
			components: { Dashboard },
			template: '<Dashboard />',
			global: { plugins: [pinia] },
		};
	},
	play: async ({ canvasElement }) => {
		const page = new DashboardPage(canvasElement as HTMLElement);
		expect(canvasElement.querySelector('[data-testid="module-cards"]')).not.toBeNull();
		expect(page.moduleCards).toHaveLength(3);
	},
};
