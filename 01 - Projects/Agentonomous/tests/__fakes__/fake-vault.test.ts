import { describe, expect, it } from 'vitest';
import { fakeVault } from './fake-ports.js';
import { isOk } from '../../src/domain/shared/result.js';

describe('fakeVault.rename', () => {
	it('moves content from old to new key', async () => {
		const vault = fakeVault({ 'a.md': 'hello' });
		const result = await vault.rename('a.md', 'b.md');
		expect(result.kind).toBe('ok');
		expect(await vault.exists('a.md')).toBe(false);
		expect(await vault.exists('b.md')).toBe(true);
		const read = await vault.read('b.md');
		expect(isOk(read)).toBe(true);
		if (read.kind !== 'ok') throw new Error('unreachable');
		expect(read.value.content).toBe('hello');
	});

	it('returns not-found when source missing', async () => {
		const vault = fakeVault({});
		const result = await vault.rename('missing.md', 'b.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('not-found');
	});

	it('returns target-exists when destination already present', async () => {
		const vault = fakeVault({ 'a.md': 'x', 'b.md': 'y' });
		const result = await vault.rename('a.md', 'b.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error).toContain('target-exists');
	});
});
