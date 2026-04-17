import { describe, expect, it } from 'vitest';
import { fakeStorage } from './fake-ports.js';
import { isOk } from '../../src/domain/shared/result.js';

describe('fakeStorage', () => {
	it('loadJson returns null for missing keys', async () => {
		const s = fakeStorage();
		const r = await s.loadJson('ns', 'missing');
		expect(isOk(r) && r.value).toBeNull();
	});

	it('saveJson + loadJson round-trips', async () => {
		const s = fakeStorage();
		await s.saveJson('ns', 'k', { x: 1 });
		const r = await s.loadJson('ns', 'k');
		expect(isOk(r) && r.value).toEqual({ x: 1 });
	});

	it('namespaces are isolated', async () => {
		const s = fakeStorage();
		await s.saveJson('a', 'k', 'A');
		await s.saveJson('b', 'k', 'B');
		const ra = await s.loadJson('a', 'k');
		const rb = await s.loadJson('b', 'k');
		expect(isOk(ra) && ra.value).toBe('A');
		expect(isOk(rb) && rb.value).toBe('B');
	});

	it('deleteKey removes a key', async () => {
		const s = fakeStorage();
		await s.saveJson('ns', 'k', 1);
		await s.deleteKey('ns', 'k');
		const r = await s.loadJson('ns', 'k');
		expect(isOk(r) && r.value).toBeNull();
	});

	it('listKeys returns all keys in a namespace', async () => {
		const s = fakeStorage();
		await s.saveJson('ns', 'a', 1);
		await s.saveJson('ns', 'b', 2);
		const r = await s.listKeys('ns');
		expect(isOk(r) && r.value.sort()).toEqual(['a', 'b']);
	});

	it('clearNamespace wipes a whole namespace', async () => {
		const s = fakeStorage();
		await s.saveJson('ns', 'a', 1);
		await s.saveJson('ns', 'b', 2);
		await s.clearNamespace('ns');
		const r = await s.listKeys('ns');
		expect(isOk(r) && r.value).toEqual([]);
	});
});
