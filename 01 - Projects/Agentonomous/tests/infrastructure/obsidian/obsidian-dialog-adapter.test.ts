import { describe, expect, it, beforeEach } from 'vitest';
import type { App as ObsidianApp } from 'obsidian';
import { ObsidianDialogAdapter } from '../../../src/infrastructure/obsidian/obsidian-dialog-adapter.js';
import { _openModals, App } from '../../__stubs__/obsidian.js';
import type { SuggestModal } from '../../__stubs__/obsidian.js';

function fakeApp(): ObsidianApp {
	return {} as ObsidianApp;
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

describe('ObsidianDialogAdapter.pickFolder', () => {
	beforeEach(() => { _openModals.splice(0); });

	it('resolves the chosen folder path', async () => {
		const app = new App();
		await app.vault.createFolder('Make');
		await app.vault.createFolder('Make/Types');
		const adapter = new ObsidianDialogAdapter(app as never);
		const promise = adapter.pickFolder({ title: 'Pick' });
		const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
		modal._chooseSuggestion('Make/Types');
		expect(await promise).toBe('Make/Types');
	});

	it('resolves null when the modal closes without a choice', async () => {
		const app = new App();
		const adapter = new ObsidianDialogAdapter(app as never);
		const promise = adapter.pickFolder();
		const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
		modal._closeWithoutChoice();
		expect(await promise).toBeNull();
	});

	it('suggest list includes existing folders and root as "/"', async () => {
		const app = new App();
		await app.vault.createFolder('Make');
		await app.vault.createFolder('Make/Types');
		const adapter = new ObsidianDialogAdapter(app as never);
		const promise = adapter.pickFolder();
		const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
		const all = await modal.getSuggestions('');
		expect(all).toContain('Make');
		expect(all).toContain('Make/Types');
		expect(all).toContain('/');  // root folder is always loaded in the stub
		// Resolve the promise so it doesn't leak into the next test
		modal._closeWithoutChoice();
		await promise;
	});

	it('maps "/" selection back to empty string through the port contract', async () => {
		const app = new App();
		const adapter = new ObsidianDialogAdapter(app as never);
		const promise = adapter.pickFolder();
		const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
		modal._chooseSuggestion('/');
		expect(await promise).toBe('');
	});

	it('query filter is case-insensitive', async () => {
		const app = new App();
		await app.vault.createFolder('Notes');
		await app.vault.createFolder('MAKE');
		const adapter = new ObsidianDialogAdapter(app as never);
		const promise = adapter.pickFolder();
		const modal = _openModals[_openModals.length - 1] as unknown as SuggestModal<string>;
		const results = await modal.getSuggestions('make');
		expect(results).toContain('MAKE');
		modal._closeWithoutChoice();
		await promise;
	});
});
