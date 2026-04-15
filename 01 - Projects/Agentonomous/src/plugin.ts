import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';
import type { ViewRegistryPort } from './domain/views/view-registry-port.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
	readonly viewRegistry: ViewRegistryPort<Plugin, PluginContext>;
};

export function createPluginContext(
	plugin: Plugin,
	settings: SettingsPort,
	viewRegistry: ViewRegistryPort<Plugin, PluginContext>,
): PluginContext {
	return { app: plugin.app, plugin, settings, viewRegistry };
}
