import type { Plugin } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export class ObsidianSettingsAdapter implements SettingsPort {
	private readonly plugin: Plugin;
	private readonly listeners = new Set<(s: unknown) => void | Promise<void>>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<Result<unknown, string>> {
		try {
			const raw: unknown = await this.plugin.loadData();
			return ok(raw ?? null);
		} catch (error) {
			return err(`failed to load: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async save(data: unknown): Promise<Result<void, string>> {
		try {
			await this.plugin.saveData(data);
			for (const l of this.listeners) { void l(data); }
			return ok(undefined);
		} catch (error) {
			return err(`failed to save: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	subscribe(listener: (s: unknown) => void | Promise<void>): Unsubscribe {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
