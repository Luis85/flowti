import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { expect } from 'vitest';
import { createPinia } from 'pinia';
import Dashboard from '../../src/ui/pages/Dashboard.vue';
import { DashboardPage } from '../../src/ui/pages/Dashboard.po.js';
import { useModuleStatusStore } from '../../src/ui/stores/module-status-store.js';
import { withRouter } from '../decorators/with-router.js';

const withModules: Decorator = (_story, context) => {
	const pinia = createPinia();
	const store = useModuleStatusStore(pinia);
	store.setModules([
		{ id: 'core', name: 'Core', status: 'ready' },
		{ id: 'event-inspector', name: 'Event Inspector', status: 'ready' },
		{ id: 'broken', name: 'Broken', status: 'degraded' },
	]);
	return {
		setup() { return {}; },
		template: '<story />',
		global: { plugins: [pinia] },
	};
};

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
	}),
};

export const WithModules: Story = {
	decorators: [withModules],
	render: () => ({
		components: { Dashboard },
		template: '<Dashboard />',
	}),
	play: async ({ canvasElement }) => {
		const page = new DashboardPage(canvasElement as HTMLElement);
		expect(canvasElement.querySelector('[data-testid="module-cards"]')).not.toBeNull();
		expect(page.moduleCards).toHaveLength(3);
	},
};
