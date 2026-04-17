import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { ObsidianVaultAdapter } from '../../../src/infrastructure/obsidian/obsidian-vault-adapter.js';
import { App as AppStub, TFile } from '../../__stubs__/obsidian.js';

function makeApp(): { app: App; vault: ReturnType<typeof fakeVault> } {
	const app = new AppStub();
	// Stub Vault.on/offref/_trigger — defined on the AppStub's vault instance
	return { app: app as unknown as App, vault: app.vault as never };
}

type VaultWithTrigger = { _trigger: (event: string, ...args: unknown[]) => void };

describe('ObsidianVaultAdapter.watch', () => {
	it('delivers create/modify/delete/rename events to subscribers', () => {
		const { app, vault } = makeApp();
		const adapter = new ObsidianVaultAdapter(app);
		const received: Array<{ kind: string; path: string; oldPath?: string }> = [];
		adapter.watch((change) => { received.push({ kind: change.kind, path: change.path, oldPath: change.oldPath }); });

		const file = new TFile('a.md');
		(vault as unknown as VaultWithTrigger)._trigger('create', file);
		(vault as unknown as VaultWithTrigger)._trigger('modify', file);
		(vault as unknown as VaultWithTrigger)._trigger('delete', file);
		(vault as unknown as VaultWithTrigger)._trigger('rename', file, 'old.md');

		expect(received.map((r) => r.kind)).toEqual(['create', 'modify', 'delete', 'rename']);
		expect(received[3]?.oldPath).toBe('old.md');
		adapter.detach();
	});

	it('unsubscribing stops further deliveries to that listener', () => {
		const { app, vault } = makeApp();
		const adapter = new ObsidianVaultAdapter(app);
		const listener = vi.fn();
		const unsub = adapter.watch(listener);

		(vault as unknown as VaultWithTrigger)._trigger('create', new TFile('a.md'));
		expect(listener).toHaveBeenCalledTimes(1);

		unsub();
		(vault as unknown as VaultWithTrigger)._trigger('create', new TFile('b.md'));
		expect(listener).toHaveBeenCalledTimes(1);
		adapter.detach();
	});

	it('detach tears down the Obsidian subscription', () => {
		const { app, vault } = makeApp();
		const adapter = new ObsidianVaultAdapter(app);
		const listener = vi.fn();
		adapter.watch(listener);
		adapter.detach();

		(vault as unknown as VaultWithTrigger)._trigger('create', new TFile('a.md'));
		expect(listener).not.toHaveBeenCalled();
	});
});
