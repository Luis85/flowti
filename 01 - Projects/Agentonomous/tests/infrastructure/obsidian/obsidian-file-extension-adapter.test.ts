import { describe, expect, it, vi } from 'vitest';
import { Plugin } from '../../__stubs__/obsidian.js';
import { ObsidianFileExtensionAdapter } from '../../../src/infrastructure/obsidian/obsidian-file-extension-adapter.js';

describe('ObsidianFileExtensionAdapter', () => {
	it('calls plugin.registerExtensions with the provided extensions and viewType', () => {
		const plugin = new Plugin();
		plugin.registerExtensions = vi.fn();
		const adapter = new ObsidianFileExtensionAdapter(plugin as never);

		adapter.register(['csv', 'tsv'], 'my-view');
		expect(plugin.registerExtensions).toHaveBeenCalledWith(['csv', 'tsv'], 'my-view');
	});

	it('returns a no-op unsubscribe function', () => {
		const plugin = new Plugin();
		plugin.registerExtensions = vi.fn();
		const adapter = new ObsidianFileExtensionAdapter(plugin as never);

		const unsub = adapter.register(['json'], 'my-view');
		expect(typeof unsub).toBe('function');
		expect(() => { unsub(); }).not.toThrow();
	});
});
