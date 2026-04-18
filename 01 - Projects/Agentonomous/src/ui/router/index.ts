import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Home from '../pages/Home.vue';
import About from '../pages/About.vue';
import Dashboard from '../pages/Dashboard.vue';
import MakeHome from '../pages/make/MakeHome.vue';
import MakeTypes from '../pages/make/MakeTypes.vue';
import MakeType from '../pages/make/MakeType.vue';
import { useMakeStore } from '../stores/make-store.js';

export function createAppRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'home', component: Home, meta: { layout: 'main' } },
			{ path: '/about', name: 'about', component: About, meta: { layout: 'main' } },
			{ path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { layout: 'dashboard' } },
			{ path: '/make', name: 'make-home', component: MakeHome, meta: { layout: 'main' } },
			{ path: '/make/types', name: 'make-types', component: MakeTypes, meta: { layout: 'main' } },
			{ path: '/make/types/new', name: 'make-type-new', component: MakeType, meta: { layout: 'main' } },
			{
				path: '/make/types/:typeId',
				name: 'make-type',
				component: MakeType,
				meta: { layout: 'main' },
				beforeEnter: async (to) => {
					const store = useMakeStore();
					if (!store.typesLoaded && !store.typesLoading) await store.loadTypes();
					if (store.typesError !== null) return { name: 'make-types' };
					const typeId = String(to.params['typeId']);
					if (store.getType(typeId) === undefined) return { name: 'make-types' };
					return true;
				},
			},
		],
	});
}
