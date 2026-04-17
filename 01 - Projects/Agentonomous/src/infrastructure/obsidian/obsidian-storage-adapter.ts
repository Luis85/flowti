import type { Plugin } from 'obsidian';
import type { StoragePort } from '../../domain/shared/storage-port.js';
import { isErr, ok, type Result } from '../../domain/shared/result.js';
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

	async loadJson(namespace: string, key: string): Promise<Result<unknown, string>> {
		const path = this.keyPath(namespace, key);
		const result = await tryAsync(async () => {
			const exists = await this.adapter.exists(path);
			if (!exists) return null;
			const raw = await this.adapter.read(path);
			return JSON.parse(raw) as unknown;
		}, { code: 'STORAGE_LOAD_FAILED', source: 'storage' });
		return mapErr(result, `storage.loadJson(${namespace}/${key})`);
	}

	async saveJson(namespace: string, key: string, value: unknown): Promise<Result<void, string>> {
		const dir = this.namespaceDir(namespace);
		const path = this.keyPath(namespace, key);
		const result = await tryAsync(async () => {
			await this.ensureDir(dir);
			await this.adapter.write(path, JSON.stringify(value, null, 2));
		}, { code: 'STORAGE_SAVE_FAILED', source: 'storage' });
		return mapErr(result, `storage.saveJson(${namespace}/${key})`);
	}

	async deleteKey(namespace: string, key: string): Promise<Result<void, string>> {
		const path = this.keyPath(namespace, key);
		const result = await tryAsync(async () => {
			const exists = await this.adapter.exists(path);
			if (exists) await this.adapter.remove(path);
		}, { code: 'STORAGE_DELETE_FAILED', source: 'storage' });
		return mapErr(result, `storage.deleteKey(${namespace}/${key})`);
	}

	async listKeys(namespace: string): Promise<Result<string[], string>> {
		const dir = this.namespaceDir(namespace);
		const result = await tryAsync(async () => {
			const exists = await this.adapter.exists(dir);
			if (!exists) return [] as string[];
			const listing = await this.adapter.list(dir);
			const files = Array.isArray(listing.files) ? listing.files : [];
			return files
				.map((p) => p.split('/').pop() ?? '')
				.filter((name) => name.endsWith('.json'))
				.map((name) => name.slice(0, -'.json'.length));
		}, { code: 'STORAGE_LIST_FAILED', source: 'storage' });
		return mapErr(result, `storage.listKeys(${namespace})`);
	}

	async clearNamespace(namespace: string): Promise<Result<void, string>> {
		const dir = this.namespaceDir(namespace);
		const result = await tryAsync(async () => {
			const exists = await this.adapter.exists(dir);
			if (exists) await this.adapter.rmdir(dir, true);
		}, { code: 'STORAGE_CLEAR_FAILED', source: 'storage' });
		return mapErr(result, `storage.clearNamespace(${namespace})`);
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

/** Map AppError → string so we keep the StoragePort's simple `string` error shape. */
function mapErr<T>(result: Result<T, { message: string }>, context: string): Result<T, string> {
	if (isErr(result)) return { kind: 'err' as const, error: `${context}: ${result.error.message}` };
	return ok(result.value);
}

function sanitize(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]/g, '_');
}
