import type { App, Plugin } from 'obsidian';
import type { CorePorts } from './core/plugin-core.js';

export type PluginContext = CorePorts & {
	readonly app: App;
	readonly plugin: Plugin;
};
