import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { App as ObsidianApp } from 'obsidian';
import { App } from '../../__stubs__/obsidian.js';
import { ObsidianVaultAdapter } from '../../../src/infrastructure/obsidian/obsidian-vault-adapter.js';
import { isOk, isErr } from '../../../src/domain/shared/result.js';

describe('ObsidianVaultAdapter', () => {
	let app: App;
	let adapter: ObsidianVaultAdapter;

	beforeEach(() => {
		app = new App();
		// The adapter expects the Obsidian App type; the stub is compatible
		adapter = new ObsidianVaultAdapter(app as never);
	});

	it('create + read round-trips content', async () => {
		await adapter.ensureFolder('notes');
		await adapter.create('notes/hello.md', '---\ntitle: Hi\n---\nBody text');
		const result = await adapter.read('notes/hello.md');
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.content).toContain('Body text');
			expect(result.value.path).toBe('notes/hello.md');
		}
	});

	it('read falls back to extractFrontmatter when cache returns null', async () => {
		await adapter.create('fm.md', '---\nauthor: Alice\n---\n');
		const result = await adapter.read('fm.md');
		if (isOk(result)) {
			expect(result.value.frontmatter['author']).toBe('Alice');
		}
	});

	it('update modifies content', async () => {
		await adapter.create('edit.md', 'v1');
		await adapter.update('edit.md', 'v2');
		const result = await adapter.read('edit.md');
		if (isOk(result)) expect(result.value.content).toBe('v2');
	});

	it('delete removes the file', async () => {
		await adapter.create('bye.md', 'content');
		await adapter.delete('bye.md');
		expect(await adapter.exists('bye.md')).toBe(false);
	});

	it('exists returns false for missing file', async () => {
		expect(await adapter.exists('ghost.md')).toBe(false);
	});

	it('list returns files in folder', async () => {
		await adapter.ensureFolder('folder');
		await adapter.ensureFolder('other');
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
		const result = await adapter.read('missing.md');
		expect(isErr(result)).toBe(true);
	});

	it('update returns err for missing file', async () => {
		const result = await adapter.update('ghost.md', 'content');
		expect(isErr(result)).toBe(true);
	});

	it('delete returns err for missing file', async () => {
		const result = await adapter.delete('ghost.md');
		expect(isErr(result)).toBe(true);
	});

	it('ensureFolder creates a missing folder so subsequent create succeeds', async () => {
		// Reproduces the user-reported ENOENT bug: before this fix, create on
		// a path whose parent folder doesn't exist threw ENOENT. ensureFolder
		// must close that gap.
		const failsBefore = await adapter.create('Make/Types/test.json', '{}');
		expect(isErr(failsBefore)).toBe(true);
		const ensured = await adapter.ensureFolder('Make/Types');
		expect(isOk(ensured)).toBe(true);
		const succeedsAfter = await adapter.create('Make/Types/test.json', '{}');
		expect(isOk(succeedsAfter)).toBe(true);
	});

	it('ensureFolder is idempotent on an existing folder', async () => {
		const first  = await adapter.ensureFolder('Make/Bases');
		const second = await adapter.ensureFolder('Make/Bases');
		expect(isOk(first)).toBe(true);
		expect(isOk(second)).toBe(true);
	});

	it('ensureFolder walks nested segments (Make/Types walks Make → Make/Types)', async () => {
		const result = await adapter.ensureFolder('a/b/c');
		expect(isOk(result)).toBe(true);
		// After nested ensure, a file in the deepest folder should create cleanly.
		const created = await adapter.create('a/b/c/leaf.md', 'leaf');
		expect(isOk(created)).toBe(true);
	});

	it('ensureFolder on root (empty or "/") is a no-op returning ok', async () => {
		expect(isOk(await adapter.ensureFolder(''))).toBe(true);
		expect(isOk(await adapter.ensureFolder('/'))).toBe(true);
	});

	it('ensureFolder returns err when a file blocks the path', async () => {
		// Create a file at 'blocked', then try to ensure it as a folder.
		await adapter.create('blocked', 'i am a file');
		const result = await adapter.ensureFolder('blocked/child');
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error).toContain('path-conflict');
	});
});

describe('ObsidianVaultAdapter.rename', () => {
	it('calls fileManager.renameFile with resolved TFile', async () => {
		const renameSpy = vi.fn().mockResolvedValue(undefined);
		const { TFile } = await import('obsidian');
		const tfile: unknown = Object.create(TFile.prototype);
		const app = {
			vault: { getAbstractFileByPath: vi.fn((p: string): unknown => p === 'a.md' ? tfile : null) },
			fileManager: { renameFile: renameSpy },
		} as unknown as ObsidianApp;
		const adapter = new ObsidianVaultAdapter(app);
		const result = await adapter.rename('a.md', 'b.md');
		expect(result.kind).toBe('ok');
		expect(renameSpy).toHaveBeenCalledWith(tfile, 'b.md');
	});

	it('returns not-found when source does not resolve', async () => {
		const app = {
			vault: { getAbstractFileByPath: vi.fn(() => null) },
			fileManager: { renameFile: vi.fn() },
		} as unknown as ObsidianApp;
		const adapter = new ObsidianVaultAdapter(app);
		const result = await adapter.rename('a.md', 'b.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('not-found');
	});

	it('returns target-exists when destination already exists', async () => {
		const { TFile } = await import('obsidian');
		const source: unknown = Object.create(TFile.prototype);
		const target: unknown = Object.create(TFile.prototype);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn((p: string): unknown => p === 'a.md' ? source : p === 'b.md' ? target : null),
			},
			fileManager: { renameFile: vi.fn() },
		} as unknown as ObsidianApp;
		const adapter = new ObsidianVaultAdapter(app);
		const result = await adapter.rename('a.md', 'b.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('target-exists');
	});

	it('wraps renameFile throw as rename-failed', async () => {
		const { TFile } = await import('obsidian');
		const tfile: unknown = Object.create(TFile.prototype);
		const app = {
			vault: { getAbstractFileByPath: vi.fn((p: string): unknown => p === 'a.md' ? tfile : null) },
			fileManager: { renameFile: vi.fn().mockRejectedValue(new Error('EIO')) },
		} as unknown as ObsidianApp;
		const adapter = new ObsidianVaultAdapter(app);
		const result = await adapter.rename('a.md', 'b.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('rename-failed');
		expect(result.error).toContain('EIO');
	});
});
