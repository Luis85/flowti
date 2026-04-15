import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Home from '../../../src/ui/pages/Home.vue';
import About from '../../../src/ui/pages/About.vue';
import { useAppStore } from '../../../src/ui/stores/app-store.js';

describe('Home page', () => {
	it('renders HelloCard with store greeting and version', async () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		router.push('/');
		await router.isReady();

		const app = useAppStore();
		app.setVersion('9.9.9');

		const wrapper = mount(Home, { global: { plugins: [router] } });
		expect(wrapper.text()).toContain('Hello from Agentonomous');
		expect(wrapper.text()).toContain('9.9.9');
	});

	it('contains a router-link to /about', () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		const wrapper = mount(Home, { global: { plugins: [router] } });
		expect(wrapper.html()).toMatch(/\/about/);
	});
});
