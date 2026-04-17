import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { ObsidianDialogAdapter } from '../../../src/infrastructure/obsidian/obsidian-dialog-adapter.js';
import { _openModals } from '../../__stubs__/obsidian.js';

function fakeApp(): App {
	return {} as App;
}

describe('ObsidianDialogAdapter', () => {
	it('confirm opens a modal and resolves false when closed without action', async () => {
		_openModals.splice(0);
		const adapter = new ObsidianDialogAdapter(fakeApp());
		const promise = adapter.confirm({ title: 'Sure?', message: 'Really?' });
		expect(_openModals).toHaveLength(1);
		// Close without clicking — should resolve false
		_openModals[0]?.close();
		const result = await promise;
		expect(result).toBe(false);
	});

	it('prompt opens a modal and resolves null when closed without action', async () => {
		_openModals.splice(0);
		const adapter = new ObsidianDialogAdapter(fakeApp());
		const promise = adapter.prompt({ title: 'Name?', message: 'Enter name' });
		expect(_openModals).toHaveLength(1);
		_openModals[0]?.close();
		const result = await promise;
		expect(result).toBeNull();
	});
});
