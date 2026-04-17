import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { PluginContextKey } from '../src/ui/plugin-context-key.js';
import './obsidian-theme.css';

const Stub = { template: '<div />' };

setup((app) => {
	app.use(createPinia());
	app.use(createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: Stub },
			{ path: '/about', component: Stub },
			{ path: '/dashboard', component: Stub },
		],
	}));
	app.provide(PluginContextKey, {} as never);
});

const preview: Preview = {
	tags: ['autodocs'],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		a11y: {
			test: 'todo',
		},
		test: {
			dangerouslyIgnoreUnhandledErrors: true,
		},
	},
};

export default preview;
