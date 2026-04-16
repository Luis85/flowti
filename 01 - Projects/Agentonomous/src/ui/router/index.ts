import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Home from '../pages/Home.vue';
import About from '../pages/About.vue';
import Dashboard from '../pages/Dashboard.vue';

export function createAppRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'home', component: Home, meta: { layout: 'main' } },
			{ path: '/about', name: 'about', component: About, meta: { layout: 'main' } },
			{ path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { layout: 'dashboard' } },
		],
	});
}
