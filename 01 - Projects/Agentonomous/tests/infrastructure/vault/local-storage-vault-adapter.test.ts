import { describe, expect, it } from 'vitest';
import { LocalStorageVaultAdapter } from '../../../src/infrastructure/vault/local-storage-vault-adapter.js';
import { isOk, isErr } from '../../../src/domain/shared/result.js';

describe('LocalStorageVaultAdapter', () => {
	it('create + read round-trips', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', '---\ntitle: Hello\n---\nBody');
		const result = await adapter.read('test.md');
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.content).toContain('Body');
			expect(result.value.frontmatter['title']).toBe('Hello');
			expect(result.value.path).toBe('test.md');
		}
	});

	it('update modifies content', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'v1');
		await adapter.update('test.md', 'v2');
		const result = await adapter.read('test.md');
		if (isOk(result)) expect(result.value.content).toBe('v2');
	});

	it('delete removes the file', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'content');
		await adapter.delete('test.md');
		expect(await adapter.exists('test.md')).toBe(false);
	});

	it('exists returns true for existing files', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('test.md', 'content');
		expect(await adapter.exists('test.md')).toBe(true);
		expect(await adapter.exists('nope.md')).toBe(false);
	});

	it('list returns files in folder', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('folder/a.md', 'a');
		await adapter.create('folder/b.md', 'b');
		await adapter.create('other/c.md', 'c');
		const result = await adapter.list('folder/');
		if (isOk(result)) {
			expect(result.value).toHaveLength(2);
			expect(result.value).toContain('folder/a.md');
		}
	});

	it('read returns err for missing file', async () => {
		const adapter = new LocalStorageVaultAdapter();
		const result = await adapter.read('missing.md');
		expect(isErr(result)).toBe(true);
	});

	it('read extracts frontmatter', async () => {
		const adapter = new LocalStorageVaultAdapter();
		await adapter.create('fm.md', '---\ntitle: Test\ntags: a\n---\nBody');
		const result = await adapter.read('fm.md');
		if (isOk(result)) {
			expect(result.value.frontmatter['title']).toBe('Test');
			expect(result.value.frontmatter['tags']).toBe('a');
		}
	});
});
