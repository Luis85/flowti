import { describe, expect, it } from 'vitest';
import { InMemoryVaultAdapter } from '../../../src/infrastructure/vault/in-memory-vault-adapter.js';
import { isOk, isErr } from '../../../src/domain/shared/result.js';

describe('InMemoryVaultAdapter', () => {
	it('create + read round-trips', async () => {
		const adapter = new InMemoryVaultAdapter();
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
		const adapter = new InMemoryVaultAdapter();
		await adapter.create('test.md', 'v1');
		await adapter.update('test.md', 'v2');
		const result = await adapter.read('test.md');
		if (isOk(result)) expect(result.value.content).toBe('v2');
	});

	it('delete removes the file', async () => {
		const adapter = new InMemoryVaultAdapter();
		await adapter.create('test.md', 'content');
		await adapter.delete('test.md');
		expect(await adapter.exists('test.md')).toBe(false);
	});

	it('exists returns true for existing files', async () => {
		const adapter = new InMemoryVaultAdapter();
		await adapter.create('test.md', 'content');
		expect(await adapter.exists('test.md')).toBe(true);
		expect(await adapter.exists('nope.md')).toBe(false);
	});

	it('list returns files in folder', async () => {
		const adapter = new InMemoryVaultAdapter();
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
		const adapter = new InMemoryVaultAdapter();
		const result = await adapter.read('missing.md');
		expect(isErr(result)).toBe(true);
	});

	it('read extracts frontmatter', async () => {
		const adapter = new InMemoryVaultAdapter();
		await adapter.create('fm.md', '---\ntitle: Test\ntags: a\n---\nBody');
		const result = await adapter.read('fm.md');
		if (isOk(result)) {
			expect(result.value.frontmatter['title']).toBe('Test');
			expect(result.value.frontmatter['tags']).toBe('a');
		}
	});

	it('ensureFolder tracks nested folder paths and exists returns true for them', async () => {
		const adapter = new InMemoryVaultAdapter();
		const result = await adapter.ensureFolder('Make/Types');
		expect(isOk(result)).toBe(true);
		expect(await adapter.exists('Make/Types')).toBe(true);
		expect(await adapter.exists('Make')).toBe(true);
	});

	it('ensureFolder is idempotent', async () => {
		const adapter = new InMemoryVaultAdapter();
		expect(isOk(await adapter.ensureFolder('x/y'))).toBe(true);
		expect(isOk(await adapter.ensureFolder('x/y'))).toBe(true);
	});

	it('ensureFolder returns err when a file blocks the path', async () => {
		const adapter = new InMemoryVaultAdapter();
		await adapter.create('blocked', 'i am a file');
		const result = await adapter.ensureFolder('blocked');
		expect(isErr(result)).toBe(true);
	});

	it('ensureFolder on root is a no-op', async () => {
		const adapter = new InMemoryVaultAdapter();
		expect(isOk(await adapter.ensureFolder(''))).toBe(true);
		expect(isOk(await adapter.ensureFolder('/'))).toBe(true);
	});
});
