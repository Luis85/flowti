import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import { createAppRouter } from './router/index.js';
import { PluginContextKey } from './plugin-context-key.js';
import { MakeContextKey } from './make-context-key.js';
import { createMakeContext } from './make-context-factory.js';
import { setMakeNavigateHandler, clearMakeNavigateHandler } from '../modules/make/make-module.js';
import { useAppStore } from './stores/app-store.js';
import { useSettingsStore } from './stores/settings-store.js';
import { useModuleStatusStore } from './stores/module-status-store.js';
import AppRoot from './AppRoot.vue';
import type { PluginContext } from '../plugin.js';

export type MountedApp = { unmount: () => void };

export function createVueApp(ctx: PluginContext, el: HTMLElement, initialRoute?: string): MountedApp {
	const vue: VueApp = createApp(AppRoot);
	const pinia = createPinia();
	const router = createAppRouter();

	vue.use(pinia);
	vue.use(router);
	if (ctx.i18n !== undefined) {
		vue.use(ctx.i18n);
	}
	vue.provide(PluginContextKey, ctx);
	const makeCtx = createMakeContext();
	if (makeCtx !== null) {
		vue.provide(MakeContextKey, makeCtx);
	}

	const appStore = useAppStore(pinia);
	appStore.setVersion(ctx.plugin.manifest.version);

	const settingsStore = useSettingsStore(pinia);
	void settingsStore.hydrate(ctx.settings, ctx.eventBus);

	const moduleStatusStore = useModuleStatusStore(pinia);
	moduleStatusStore.setModules(ctx.moduleStatus);

	if (initialRoute !== undefined) void router.push(initialRoute);

	vue.mount(el);

	// Wire the command-palette nav bridge only after a successful mount —
	// otherwise a mount failure (vue.mount throws synchronously) would leave
	// a handler pointing at a never-live router, and the next createVueApp
	// call would race with the orphan.
	setMakeNavigateHandler((path) => { void router.push(path); });

	return {
		unmount: () => {
			clearMakeNavigateHandler();
			settingsStore.dispose();
			vue.unmount();
		},
	};
}
