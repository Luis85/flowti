import { describe, expect, it } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianStorageAdapter } from '../../../src/infrastructure/obsidian/obsidian-storage-adapter.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

type FakeAdapter = {
	files: Map<string, string>;
	dirs: Set<string>;
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
	remove(path: string): Promise<void>;
	mkdir(path: string): Promise<void>;
	rmdir(path: string, recursive: boolean): Promise<void>;
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
};

function createFakeAdapter(): FakeAdapter {
	const files = new Map<string, string>();
	const dirs = new Set<string>();
	return {
		files,
		dirs,
		exists: async (path) => files.has(path) || dirs.has(path),
		read: async (path) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`not found: ${path}`);
			return content;
		},
		write: async (path, data) => { files.set(path, data); },
		remove: async (path) => { files.delete(path); },
		mkdir: async (path) => { dirs.add(path); },
		rmdir: async (path, recursive) => {
			dirs.delete(path);
			if (recursive) {
				for (const key of [...files.keys()]) {
					if (key.startsWith(`${path}/`)) files.delete(key);
				}
				for (const key of [...dirs]) {
					if (key.startsWith(`${path}/`)) dirs.delete(key);
				}
			}
		},
		list: async (path) => {
			const prefix = `${path}/`;
			const direct = [...files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'));
			return { files: direct, folders: [] };
		},
	};
}

function pluginWith(adapter: FakeAdapter): Plugin {
	return { app: { vault: { adapter } } } as unknown as Plugin;
}

describe('ObsidianStorageAdapter', () => {
	it('loadJson returns null for missing key', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa));
		const r = await s.loadJson('ns', 'missing');
		expect(isOk(r) && r.value).toBeNull();
	});

	it('saveJson writes a namespaced path and loadJson reads it back', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa), '.data');
		await s.saveJson('ns', 'k', { hello: 'world' });
		expect(fa.files.has('.data/ns/k.json')).toBe(true);
		const r = await s.loadJson('ns', 'k');
		expect(isOk(r) && r.value).toEqual({ hello: 'world' });
	});

	it('deleteKey removes the file', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa));
		await s.saveJson('ns', 'k', 1);
		await s.deleteKey('ns', 'k');
		const r = await s.loadJson('ns', 'k');
		expect(isOk(r) && r.value).toBeNull();
	});

	it('listKeys strips the .json extension and filters non-JSON entries', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa), '.data');
		await s.saveJson('ns', 'a', 1);
		await s.saveJson('ns', 'b', 2);
		// Non-JSON file that must not appear in listing
		fa.files.set('.data/ns/readme.txt', 'ignore me');
		const r = await s.listKeys('ns');
		expect(isOk(r) && r.value.sort()).toEqual(['a', 'b']);
	});

	it('clearNamespace removes the namespace dir recursively', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa), '.data');
		await s.saveJson('ns', 'k', 1);
		await s.clearNamespace('ns');
		expect(fa.files.has('.data/ns/k.json')).toBe(false);
	});

	it('sanitizes keys and namespaces to safe filesystem paths', async () => {
		const fa = createFakeAdapter();
		const s = new ObsidianStorageAdapter(pluginWith(fa), '.data');
		await s.saveJson('ns/with slash', 'weird: key', 1);
		const written = [...fa.files.keys()][0] ?? '';
		expect(written).toBe('.data/ns_with_slash/weird__key.json');
	});

	it('returns err when loadJson parses invalid JSON', async () => {
		const fa = createFakeAdapter();
		fa.files.set('.data/ns/k.json', '{not json');
		const s = new ObsidianStorageAdapter(pluginWith(fa), '.data');
		const r = await s.loadJson('ns', 'k');
		expect(isErr(r)).toBe(true);
	});
});
