import type { Preview, Decorator } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { PluginContextKey } from '../src/ui/plugin-context-key.js';
import './obsidian-theme.css';

const Stub = { template: '<div />' };

setup((app) => {
	// NOTE: no Pinia installed on the app on purpose.  Pinia is created
	// fresh per story in `beforeEach` below; components fall back to the
	// activePinia when no pinia is injected.  This isolates every story
	// from state accumulated by previous stories.
	app.use(createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: Stub },
			{ path: '/about', component: Stub },
			{ path: '/dashboard', component: Stub },
			{ path: '/make', component: Stub },
			{ path: '/make/types', component: Stub },
			{ path: '/make/types/:typeId', component: Stub },
		],
	}));
	app.provide(PluginContextKey, {} as never);
});

/**
 * Toggle `body.theme-dark` / `body.theme-light` to mirror Obsidian's own
 * theme classes.  The same CSS variable set that drives components
 * inside Obsidian drives them here — flip the toolbar, flip the variables.
 */
const withObsidianTheme: Decorator = (story, ctx) => ({
	setup() {
		const theme = (ctx.globals['theme'] as string | undefined) ?? 'dark';
		document.body.classList.toggle('theme-dark', theme === 'dark');
		document.body.classList.toggle('theme-light', theme === 'light');
		return {};
	},
	template: '<story />',
});

const preview: Preview = {
	tags: ['autodocs'],
	beforeEach() {
		// Fresh Pinia for every story — matches how unit tests set up
		// `setActivePinia(createPinia())` per test.  Eliminates the class
		// of "story B inherits story A's paused/filter/search state" bugs.
		setActivePinia(createPinia());
	},
	decorators: [withObsidianTheme],
	globalTypes: {
		theme: {
			description: 'Obsidian theme (drives the CSS variable set)',
			defaultValue: 'dark',
			toolbar: {
				title: 'Theme',
				icon: 'mirror',
				items: [
					{ value: 'dark', title: 'Dark', icon: 'moon' },
					{ value: 'light', title: 'Light', icon: 'sun' },
				],
				dynamicTitle: true,
			},
		},
	},
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
	},
};

export default preview;
