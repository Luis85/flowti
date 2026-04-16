import { createMemoryHistory, createRouter } from 'vue-router';
import type { Decorator } from '@storybook/vue3';

export const withRouter: Decorator = (_story, _context) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: { template: '<div>Home stub</div>' } },
			{ path: '/about', component: { template: '<div>About stub</div>' } },
			{ path: '/dashboard', component: { template: '<div>Dashboard stub</div>' } },
		],
	});

	return {
		setup() {
			return {};
		},
		template: '<story />',
		global: { plugins: [router] },
	};
};
