import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianCommandAdapter } from '../../../src/infrastructure/obsidian/obsidian-command-adapter.js';
import { createFakePlugin } from './fake-plugin.js';
import { fakeViews } from '../../__fakes__/fake-ports.js';

describe('ObsidianCommandAdapter', () => {
	it('register() calls plugin.addCommand with correct id and name', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
		adapter.register({ id: 'test-cmd', name: 'Test command', callback: () => {} });
		expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-cmd', name: 'Test command' }));
	});

	it('register() with ribbon creates a ribbon icon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: false },
		});
		expect(mockEl.style.display).toBe('none');
	});

	it('register() with opensView auto-generates callback via viewRegistry', () => {
		const plugin = createFakePlugin();
		const views = fakeViews();
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.unregisterAll();
		expect(mockEl.remove).toHaveBeenCalled();
	});

	it('register() does not throw for commands with no ribbon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
		expect(() => { adapter.register({ id: 'no-ribbon', name: 'No Ribbon', callback: () => {} }); }).not.toThrow();
	});

	it('register() ribbon click callback invokes the command callback', () => {
		const plugin = createFakePlugin();
		const callback = vi.fn();
		let capturedClickFn: (() => void) | undefined;
		plugin.addRibbonIcon = vi.fn((_icon: string, _title: string, fn: () => void) => {
			capturedClickFn = fn;
			return { style: { display: '' }, remove: vi.fn() };
		});
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback,
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		capturedClickFn?.();
		expect(callback).toHaveBeenCalled();
	});
});
