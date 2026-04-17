import type { Plugin } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { err, isOk, ok, type Result } from '../../domain/shared/result.js';
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

	async loadSection(key: string): Promise<Result<unknown, string>> {
		const loaded = await this.load();
		if (!isOk(loaded)) return loaded;
		const blob = isBlob(loaded.value) ? loaded.value : {};
		return ok(blob[key] ?? null);
	}

	async saveSection(key: string, value: unknown): Promise<Result<void, string>> {
		const loaded = await this.load();
		if (!isOk(loaded)) return loaded;
		const blob = isBlob(loaded.value) ? { ...loaded.value } : {};
		blob[key] = value;
		return this.save(blob);
	}

	subscribe(listener: (s: unknown) => void | Promise<void>): Unsubscribe {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}

function isBlob(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
