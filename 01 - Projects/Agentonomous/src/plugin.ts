import type { App, Plugin } from 'obsidian';
import type { I18n } from 'vue-i18n';
import type { CorePorts } from './core/plugin-core.js';

export type PluginContext = CorePorts & {
	readonly app: App;
	readonly plugin: Plugin;
	/** vue-i18n instance. Installed on the Vue app in createVueApp(). */
	readonly i18n?: I18n;
};
