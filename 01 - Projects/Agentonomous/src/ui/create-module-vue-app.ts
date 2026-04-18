import { createApp, type App as VueApp, type Component } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import type { PluginContext } from '../plugin.js';
import { PluginContextKey } from './plugin-context-key.js';
import { MakeContextKey } from './make-context-key.js';
import { createMakeContext } from './make-context-factory.js';

export type MountedModuleApp = {
	readonly pinia: Pinia;
	unmount: () => void;
};

/**
 * Shared factory for sidebar module views.
 *
 * Installs Pinia, vue-i18n (if available on ctx), and provides PluginContext
 * via injection — same guarantees as the main Homepage view, without the
 * store hydration that is homepage-specific.
 *
 * Each sidebar leaf must call this with a fresh HTMLElement so that Pinia
 * instances stay isolated per leaf.
 *
 * @param rootComponent - The Vue component to mount as the root
 * @param ctx           - PluginContext injected as PluginContextKey
 * @param el            - Host DOM element (the leaf's contentEl)
 * @param props         - Optional root-level props forwarded to createApp()
 */
export function createModuleVueApp(
	rootComponent: Component,
	ctx: PluginContext,
	el: HTMLElement,
	props?: Record<string, unknown>,
): MountedModuleApp {
	const vue: VueApp = createApp(rootComponent, props);
	const pinia = createPinia();

	vue.use(pinia);

	// Install i18n if available on the context
	if (ctx.i18n !== undefined) {
		vue.use(ctx.i18n as never);
	}

	vue.provide(PluginContextKey, ctx);
	const makeCtx = createMakeContext();
	if (makeCtx !== null) {
		vue.provide(MakeContextKey, makeCtx);
	}
	vue.mount(el);

	return {
		pinia,
		unmount: () => { vue.unmount(); },
	};
}
