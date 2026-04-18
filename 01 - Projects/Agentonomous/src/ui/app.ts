import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import { createAppRouter } from './router/index.js';
import { PluginContextKey } from './plugin-context-key.js';
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

	const appStore = useAppStore(pinia);
	appStore.setVersion(ctx.plugin.manifest.version);

	const settingsStore = useSettingsStore(pinia);
	void settingsStore.hydrate(ctx.settings, ctx.eventBus);

	const moduleStatusStore = useModuleStatusStore(pinia);
	moduleStatusStore.setModules(ctx.moduleStatus);

	if (initialRoute !== undefined) void router.push(initialRoute);

	vue.mount(el);

	return {
		unmount: () => {
			settingsStore.dispose();
			vue.unmount();
		},
	};
}
