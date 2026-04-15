import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Home from '../pages/Home.vue';
import About from '../pages/About.vue';

export function createAppRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'home', component: Home },
			{ path: '/about', name: 'about', component: About },
		],
	});
}
