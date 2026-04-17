import { describe, expect, it } from 'vitest';
import { diffSettingsBlob } from '../../../src/domain/settings/diff-settings-blob.js';

describe('diffSettingsBlob', () => {
	it('returns empty when blobs are equal', () => {
		const a = { core: { logLevel: 'info' } };
		const b = { core: { logLevel: 'info' } };
		expect(diffSettingsBlob(a, b)).toEqual([]);
	});

	it('detects a changed section', () => {
		const a = { core: { logLevel: 'info' } };
		const b = { core: { logLevel: 'debug' } };
		const changes = diffSettingsBlob(a, b);
		expect(changes).toHaveLength(1);
		expect(changes[0]).toEqual({
			key: 'core',
			previous: { logLevel: 'info' },
			current: { logLevel: 'debug' },
		});
	});

	it('detects added sections', () => {
		const a = {};
		const b = { core: { logLevel: 'info' } };
		const changes = diffSettingsBlob(a, b);
		expect(changes).toEqual([{ key: 'core', current: { logLevel: 'info' } }]);
	});

	it('detects removed sections', () => {
		const a = { core: { logLevel: 'info' } };
		const b = {};
		const changes = diffSettingsBlob(a, b);
		expect(changes).toEqual([{ key: 'core', previous: { logLevel: 'info' } }]);
	});

	it('handles non-object inputs gracefully', () => {
		expect(diffSettingsBlob(null, { core: {} })).toEqual([{ key: 'core', current: {} }]);
		expect(diffSettingsBlob({ core: {} }, null)).toEqual([{ key: 'core', previous: {} }]);
		expect(diffSettingsBlob(null, null)).toEqual([]);
	});

	it('flags multiple changed sections', () => {
		const a = { core: { x: 1 }, fileDetail: { enabled: true } };
		const b = { core: { x: 2 }, fileDetail: { enabled: true }, newMod: { y: 9 } };
		const changes = diffSettingsBlob(a, b);
		expect(changes.map((c) => c.key).sort()).toEqual(['core', 'newMod']);
	});
});
