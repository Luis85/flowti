import type { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, validateSettings, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianSettingsAdapter implements SettingsPort {
	private readonly plugin: Plugin;
	private readonly listeners = new Set<(s: PluginSettings) => void>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<Result<PluginSettings, string>> {
		try {
			const raw: unknown = await this.plugin.loadData();
			if (raw === null || raw === undefined) return ok(DEFAULT_SETTINGS);
			const validated = validateSettings(raw);
			if (validated.kind === 'err') return ok(DEFAULT_SETTINGS);
			return validated;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return err(`failed to load settings: ${msg}`);
		}
	}

	async save(settings: PluginSettings): Promise<Result<void, string>> {
		try {
			await this.plugin.saveData(settings);
			for (const l of this.listeners) l(settings);
			return ok(undefined);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return err(`failed to save settings: ${msg}`);
		}
	}

	subscribe(listener: (s: PluginSettings) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
