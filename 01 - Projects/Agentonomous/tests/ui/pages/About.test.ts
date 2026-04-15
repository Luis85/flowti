import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import About from '../../../src/ui/pages/About.vue';
import Home from '../../../src/ui/pages/Home.vue';

describe('About page', () => {
	it('renders the Agentonomous title', () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		const wrapper = mount(About, { global: { plugins: [router] } });
		expect(wrapper.text()).toContain('Agentonomous');
	});

	it('contains a router-link back to /', () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		const wrapper = mount(About, { global: { plugins: [router] } });
		expect(wrapper.html()).toMatch(/href="\/"/);
	});

	it('displays the pluginVersion from the store', async () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		const { useAppStore } = await import('../../../src/ui/stores/app-store.js');
		const app = useAppStore();
		app.setVersion('1.2.3');
		const wrapper = mount(About, { global: { plugins: [router] } });
		expect(wrapper.text()).toContain('1.2.3');
	});
});
