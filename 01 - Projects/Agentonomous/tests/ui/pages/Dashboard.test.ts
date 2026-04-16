import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Dashboard from '../../../src/ui/pages/Dashboard.vue';
import { DashboardPage } from '../../../src/ui/pages/Dashboard.po.js';
import { useModuleStatusStore } from '../../../src/ui/stores/module-status-store.js';

describe('Dashboard page', () => {
	it('renders module status cards', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const store = useModuleStatusStore();
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'event-inspector', name: 'Event Inspector', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/dashboard', component: Dashboard }],
		});
		router.push('/dashboard');
		await router.isReady();

		const wrapper = mount(Dashboard, { global: { plugins: [pinia, router] } });
		const page = new DashboardPage(wrapper.element as HTMLElement);
		expect(page.moduleCards).toHaveLength(3);
		expect(page.moduleCards[0].name).toBe('Core');
		expect(page.moduleCards[0].status).toBe('ready');
		expect(page.moduleCards[2].status).toBe('degraded');
	});

	it('renders empty state when no modules loaded', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const store = useModuleStatusStore();
		store.setModules([]);

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/dashboard', component: Dashboard }],
		});
		router.push('/dashboard');
		await router.isReady();

		const wrapper = mount(Dashboard, { global: { plugins: [pinia, router] } });
		const page = new DashboardPage(wrapper.element as HTMLElement);
		expect(page.moduleCards).toHaveLength(0);
	});
});
