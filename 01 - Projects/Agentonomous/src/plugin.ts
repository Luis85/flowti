import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';
import type { ViewRegistryPort } from './domain/views/view-registry-port.js';
import type { EventBus } from './domain/shared/event-bus.js';
import type { LoggerPort } from './domain/shared/logger-port.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
	readonly viewRegistry: ViewRegistryPort<Plugin, PluginContext>;
	readonly eventBus: EventBus;
	readonly logger: LoggerPort;
};
