import { describe, it, expect } from 'vitest';
import { createMemfsVaultAdapter } from '../../../src/infrastructure/vault/memfs-vault-adapter.js';

describe('MemfsVaultAdapter', () => {
	it('reads a file that was written', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': '---\nid: agent-elena\n---\n',
		});
		const result = await adapter.readFile('agents/elena.md');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toContain('agent-elena');
	});

	it('returns error for missing file', async () => {
		const adapter = createMemfsVaultAdapter({});
		const result = await adapter.readFile('nonexistent.md');
		expect(result.ok).toBe(false);
	});

	it('lists files in a directory', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': '---\nid: a\n---',
			'agents/marcus.md': '---\nid: b\n---',
			'config/traits/unkillable.md': '---\nid: t\n---',
		});
		const files = await adapter.listFiles('agents/');
		expect(files).toHaveLength(2);
		expect(files).toContain('agents/elena.md');
		expect(files).toContain('agents/marcus.md');
	});

	it('writes and reads back a file', async () => {
		const adapter = createMemfsVaultAdapter({});
		const writeResult = await adapter.writeFile('test.md', 'hello');
		expect(writeResult.ok).toBe(true);

		const readResult = await adapter.readFile('test.md');
		expect(readResult.ok).toBe(true);
		if (readResult.ok) expect(readResult.value).toBe('hello');
	});

	it('checks file existence', async () => {
		const adapter = createMemfsVaultAdapter({
			'exists.md': 'content',
		});
		expect(await adapter.exists('exists.md')).toBe(true);
		expect(await adapter.exists('nope.md')).toBe(false);
	});

	it('deletes a file', async () => {
		const adapter = createMemfsVaultAdapter({
			'delete-me.md': 'content',
		});
		const result = await adapter.deleteFile('delete-me.md');
		expect(result.ok).toBe(true);
		expect(await adapter.exists('delete-me.md')).toBe(false);
	});
});
