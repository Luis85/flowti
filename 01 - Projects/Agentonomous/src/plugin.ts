// src/plugin.ts (INITIAL STUB — expanded in Chunk 6)
import type { App, Plugin } from 'obsidian';
import type { SettingsPort } from './domain/settings/settings-port.js';

export type PluginContext = {
	readonly app: App;
	readonly plugin: Plugin;
	readonly settings: SettingsPort;
};
