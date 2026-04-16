import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import DashboardLayout from '../../../src/ui/layouts/DashboardLayout.vue';

function makeRouter() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: { template: '<div />' } },
			{ path: '/about', component: { template: '<div />' } },
			{ path: '/dashboard', component: { template: '<div />' } },
		],
	});
}

describe('DashboardLayout', () => {
	it('renders the default slot content', () => {
		setActivePinia(createPinia());
		const router = makeRouter();
		const wrapper = mount(DashboardLayout, {
			slots: { default: '<p>Dashboard content</p>' },
			global: { plugins: [router] },
		});
		expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Dashboard content');
	});

	it('renders the header with version from store', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const router = makeRouter();
		const wrapper = mount(DashboardLayout, {
			slots: { default: '<p>x</p>' },
			global: { plugins: [pinia, router] },
		});
		expect(wrapper.find('[data-testid="dashboard-header"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="dashboard-version"]').exists()).toBe(true);
	});

	it('renders the sidebar with nav links', () => {
		setActivePinia(createPinia());
		const router = makeRouter();
		const wrapper = mount(DashboardLayout, {
			slots: { default: '<p>x</p>' },
			global: { plugins: [router] },
		});
		expect(wrapper.find('[data-testid="dashboard-sidebar"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="nav-home"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="nav-about"]').exists()).toBe(true);
	});

	it('applies the correct layout class', () => {
		setActivePinia(createPinia());
		const router = makeRouter();
		const wrapper = mount(DashboardLayout, {
			slots: { default: '<p>x</p>' },
			global: { plugins: [router] },
		});
		expect(wrapper.classes()).toContain('agentonomous-layout--dashboard');
	});
});
