import type { Preview, Decorator } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createI18n } from 'vue-i18n';
import { ref, readonly } from 'vue';
import { PluginContextKey } from '../src/ui/plugin-context-key.js';
import { MakeContextKey } from '../src/ui/make-context-key.js';
import { MAKE_DEFAULTS } from '../src/modules/make/make-settings.js';
import type { MakeContext } from '../src/modules/make/make-context.js';
import type { MakeService } from '../src/modules/make/make-service.js';
import type { LoggerPort } from '../src/domain/shared/logger-port.js';
import type { WorkspacePort } from '../src/domain/shared/workspace-port.js';
import coreMessages from '../src/modules/core/locales/en.json' with { type: 'json' };
import makeMessages from '../src/modules/make/locales/en.json' with { type: 'json' };
import eventInspectorMessages from '../src/modules/event-inspector/locales/en.json' with { type: 'json' };
import fileDetailMessages from '../src/modules/file-detail/locales/en.json' with { type: 'json' };
import healthMonitorMessages from '../src/modules/health-monitor/locales/en.json' with { type: 'json' };
import './obsidian-theme.css';

const Stub = { template: '<div />' };

const notImpl = () => Promise.resolve({ kind: 'err' as const, error: { kind: 'not-implemented' as const } });
const stubMakeService: MakeService = {
	listTypes:          () => Promise.resolve({ kind: 'ok' as const, value: { types: [], issues: [] } }),
	loadType:           (id) => Promise.resolve({ kind: 'err' as const, error: { kind: 'type-not-found' as const, typeId: id } }),
	createType:         notImpl,
	updateType:         notImpl,
	retryFailedMoves:   notImpl,
	deleteType:         notImpl,
	deleteCorruptFile:  notImpl,
	listInstances:      () => Promise.resolve({ kind: 'ok' as const, value: [] }),
	createInstance:     notImpl,
	deleteInstance:     notImpl,
	deleteInstances:    () => Promise.resolve({ kind: 'ok' as const, value: { deletedPaths: [], failures: [] } }),
	regenerateBaseFile: notImpl,
	toggleFavorite:     () => Promise.resolve({ kind: 'ok' as const, value: true }),
	getKpis:            () => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] }),
};

const noopLogger: LoggerPort = {
	debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, setLevel: () => {},
};

const noopWorkspace: WorkspacePort = {
	openFile: () => Promise.resolve({ kind: 'ok' as const, value: undefined }),
};

function createStubMakeContext(): MakeContext {
	const settings$ = ref({ ...MAKE_DEFAULTS });
	return {
		service:         stubMakeService,
		settings$:       readonly(settings$),
		subscribe:       () => () => {},
		workspace:       noopWorkspace,
		logger:          noopLogger,
		kpisDebounceMs:  0,
	};
}

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
	app.use(createI18n({
		legacy: false,
		locale: 'en',
		fallbackLocale: 'en',
		missingWarn: false,
		fallbackWarn: false,
		messages: {
			en: {
				...coreMessages,
				...makeMessages,
				...eventInspectorMessages,
				...fileDetailMessages,
				...healthMonitorMessages,
			},
		},
	}));
	app.provide(PluginContextKey, {} as never);
	app.provide(MakeContextKey, createStubMakeContext());
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
