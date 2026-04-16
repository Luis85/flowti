import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianCommandAdapter } from '../../../src/infrastructure/obsidian/obsidian-command-adapter.js';
import { createFakePlugin } from './fake-plugin.js';
import type { ViewRegistryPort } from '../../../src/domain/views/view-registry-port.js';

function fakeViewRegistry(): ViewRegistryPort {
	return { registerAll: vi.fn(), openView: vi.fn(async () => {}) };
}

describe('ObsidianCommandAdapter', () => {
	it('register() calls plugin.addCommand with correct id and name', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViewRegistry());
		adapter.register({ id: 'test-cmd', name: 'Test command', callback: () => {} });
		expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-cmd', name: 'Test command' }));
	});

	it('register() with ribbon creates a ribbon icon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViewRegistry());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		expect(plugin.addRibbonIcon).toHaveBeenCalledWith('bot', 'Open', expect.any(Function));
	});

	it('register() with ribbon visibleByDefault=false hides the element', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViewRegistry());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: false },
		});
		expect(mockEl.style.display).toBe('none');
	});

	it('register() with opensView auto-generates callback via viewRegistry', () => {
		const plugin = createFakePlugin();
		const views = fakeViewRegistry();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, views);
		adapter.register({ id: 'test-cmd', name: 'Test', opensView: 'test-view' });
		// The addCommand callback should call viewRegistry.openView when invoked
		const commandCall = plugin.addCommand.mock.calls[0][0] as { callback: () => void };
		commandCall.callback();
		expect(views.openView).toHaveBeenCalledWith(plugin, 'test-view');
	});

	it('setRibbonVisibility toggles display style', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViewRegistry());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.setRibbonVisibility(false);
		expect(mockEl.style.display).toBe('none');
		adapter.setRibbonVisibility(true);
		expect(mockEl.style.display).toBe('');
	});

	it('unregisterAll() removes ribbon elements', () => {
		const plugin = createFakePlugin();
		const mockEl = { style: { display: '' }, remove: vi.fn() };
		plugin.addRibbonIcon = vi.fn(() => mockEl);
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViewRegistry());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.unregisterAll();
		expect(mockEl.remove).toHaveBeenCalled();
	});
});
