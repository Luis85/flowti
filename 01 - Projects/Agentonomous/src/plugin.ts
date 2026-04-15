import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';
import type { ViewRegistry } from './infrastructure/obsidian/view-registry.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
	readonly viewRegistry: ViewRegistry;
};

export function createPluginContext(plugin: Plugin, settings: SettingsPort, viewRegistry: ViewRegistry): PluginContext {
	return { app: plugin.app, plugin, settings, viewRegistry };
}
