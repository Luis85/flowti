import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Home from '../../../src/ui/pages/Home.vue';
import About from '../../../src/ui/pages/About.vue';
import { HomePage } from '../../../src/ui/pages/Home.po.js';
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
		await router.push('/');
		await router.isReady();

		const app = useAppStore();
		app.setVersion('9.9.9');

		const wrapper = mount(Home, { global: { plugins: [router] } });
		const page = new HomePage(wrapper.element as HTMLElement);
		expect(page.greeting).toContain('Hello from Agentonomous');
		expect(page.version).toContain('9.9.9');
	});

	it('has a link to /about', async () => {
		setActivePinia(createPinia());
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', component: Home },
				{ path: '/about', component: About },
			],
		});
		await router.push('/');
		await router.isReady();
		const wrapper = mount(Home, { global: { plugins: [router] } });
		const page = new HomePage(wrapper.element as HTMLElement);
		expect(page.aboutLink).not.toBeNull();
	});
});
