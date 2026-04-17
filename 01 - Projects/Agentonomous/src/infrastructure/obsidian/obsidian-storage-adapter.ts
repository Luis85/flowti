import type { Plugin } from 'obsidian';
import type { StoragePort } from '../../domain/shared/storage-port.js';
import type { AppError } from '../../domain/shared/app-error.js';
import type { Result } from '../../domain/shared/result.js';
import { tryAsync } from '../../domain/shared/try-async.js';

/**
 * Obsidian-backed storage.  Writes JSON files under the plugin's data
 * directory via the vault adapter.  One folder per namespace, one file
 * per key (e.g. `<baseDir>/<namespace>/<key>.json`).
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

	loadJson(namespace: string, key: string): Promise<Result<unknown, AppError>> {
		const path = this.keyPath(namespace, key);
		return tryAsync(async () => {
			const exists = await this.adapter.exists(path);
			if (!exists) return null;
			const raw = await this.adapter.read(path);
			return JSON.parse(raw) as unknown;
		}, { code: 'STORAGE_LOAD_FAILED', source: `storage:${namespace}/${key}` });
	}

	saveJson(namespace: string, key: string, value: unknown): Promise<Result<void, AppError>> {
		const dir = this.namespaceDir(namespace);
		const path = this.keyPath(namespace, key);
		return tryAsync(async () => {
			await this.ensureDir(dir);
			await this.adapter.write(path, JSON.stringify(value, null, 2));
		}, { code: 'STORAGE_SAVE_FAILED', source: `storage:${namespace}/${key}` });
	}

	deleteKey(namespace: string, key: string): Promise<Result<void, AppError>> {
		const path = this.keyPath(namespace, key);
		return tryAsync(async () => {
			const exists = await this.adapter.exists(path);
			if (exists) await this.adapter.remove(path);
		}, { code: 'STORAGE_DELETE_FAILED', source: `storage:${namespace}/${key}` });
	}

	listKeys(namespace: string): Promise<Result<string[], AppError>> {
		const dir = this.namespaceDir(namespace);
		return tryAsync(async () => {
			const exists = await this.adapter.exists(dir);
			if (!exists) return [];
			const listing = await this.adapter.list(dir);
			const files = Array.isArray(listing.files) ? listing.files : [];
			return files
				.map((p) => p.split('/').pop() ?? '')
				.filter((name) => name.endsWith('.json'))
				.map((name) => name.slice(0, -'.json'.length));
		}, { code: 'STORAGE_LIST_FAILED', source: `storage:${namespace}` });
	}

	clearNamespace(namespace: string): Promise<Result<void, AppError>> {
		const dir = this.namespaceDir(namespace);
		return tryAsync(async () => {
			const exists = await this.adapter.exists(dir);
			if (exists) await this.adapter.rmdir(dir, true);
		}, { code: 'STORAGE_CLEAR_FAILED', source: `storage:${namespace}` });
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
