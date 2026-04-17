import type { Plugin } from 'obsidian';
import type { StoragePort } from '../../domain/shared/storage-port.js';
import { err, ok, type Result } from '../../domain/shared/result.js';

/**
 * Obsidian-backed storage.  Writes JSON files under the plugin's data
 * directory via the vault adapter.  One folder per namespace, one file
 * per key (e.g. `<plugin>/data/<namespace>/<key>.json`).
 *
 * Keys and namespaces are normalized: non-alphanumeric characters become
 * `_` to keep filesystem paths safe.
 */
export class ObsidianStorageAdapter implements StoragePort {
	private readonly plugin: Plugin;
	private readonly baseDir: string;

	constructor(plugin: Plugin, baseDir = '.agentonomous') {
		this.plugin = plugin;
		this.baseDir = baseDir;
	}

	async loadJson(namespace: string, key: string): Promise<Result<unknown, string>> {
		const path = this.keyPath(namespace, key);
		try {
			const exists = await this.adapter.exists(path);
			if (!exists) return ok(null);
			const raw = await this.adapter.read(path);
			return ok(JSON.parse(raw));
		} catch (e) {
			return err(`storage.loadJson(${namespace}/${key}): ${toMessage(e)}`);
		}
	}

	async saveJson(namespace: string, key: string, value: unknown): Promise<Result<void, string>> {
		const dir = this.namespaceDir(namespace);
		const path = this.keyPath(namespace, key);
		try {
			await this.ensureDir(dir);
			await this.adapter.write(path, JSON.stringify(value, null, 2));
			return ok(undefined);
		} catch (e) {
			return err(`storage.saveJson(${namespace}/${key}): ${toMessage(e)}`);
		}
	}

	async deleteKey(namespace: string, key: string): Promise<Result<void, string>> {
		const path = this.keyPath(namespace, key);
		try {
			const exists = await this.adapter.exists(path);
			if (exists) await this.adapter.remove(path);
			return ok(undefined);
		} catch (e) {
			return err(`storage.deleteKey(${namespace}/${key}): ${toMessage(e)}`);
		}
	}

	async listKeys(namespace: string): Promise<Result<string[], string>> {
		const dir = this.namespaceDir(namespace);
		try {
			const exists = await this.adapter.exists(dir);
			if (!exists) return ok([]);
			const listing = await this.adapter.list(dir);
			const files = Array.isArray(listing.files) ? listing.files : [];
			const keys = files
				.map((p) => p.split('/').pop() ?? '')
				.filter((name) => name.endsWith('.json'))
				.map((name) => name.slice(0, -'.json'.length));
			return ok(keys);
		} catch (e) {
			return err(`storage.listKeys(${namespace}): ${toMessage(e)}`);
		}
	}

	async clearNamespace(namespace: string): Promise<Result<void, string>> {
		const dir = this.namespaceDir(namespace);
		try {
			const exists = await this.adapter.exists(dir);
			if (exists) await this.adapter.rmdir(dir, true);
			return ok(undefined);
		} catch (e) {
			return err(`storage.clearNamespace(${namespace}): ${toMessage(e)}`);
		}
	}

	private get adapter(): Plugin['app']['vault']['adapter'] {
		return this.plugin.app.vault.adapter;
	}

	private namespaceDir(namespace: string): string {
		return `${this.baseDir}/${sanitize(namespace)}`;
	}

	private keyPath(namespace: string, key: string): string {
		return `${this.namespaceDir(namespace)}/${sanitize(key)}.json`;
	}

	private async ensureDir(path: string): Promise<void> {
		const exists = await this.adapter.exists(path);
		if (!exists) await this.adapter.mkdir(path);
	}
}

function sanitize(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function toMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
