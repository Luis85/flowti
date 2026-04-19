import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianCommandAdapter } from '../../../src/infrastructure/obsidian/obsidian-command-adapter.js';
import type { ViewRegistryPort } from '../../../src/domain/views/view-registry-port.js';
import { createFakePlugin } from './fake-plugin.js';
import { fakeViews, fakeLogger } from '../../__fakes__/fake-ports.js';

describe('ObsidianCommandAdapter', () => {
	it('register() calls plugin.addCommand with correct id and name', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
		adapter.register({ id: 'test-cmd', name: 'Test command', callback: () => {} });
		expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-cmd', name: 'Test command' }));
	});

	it('register() with ribbon creates a ribbon icon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: false },
		});
		expect(mockEl.style.display).toBe('none');
	});

	it('register() with opensView auto-generates callback via viewRegistry', () => {
		const plugin = createFakePlugin();
		const views = fakeViews();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, views, fakeLogger());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback: () => {},
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		adapter.unregisterAll();
		expect(mockEl.remove).toHaveBeenCalled();
	});

	it('register() does not throw for commands with no ribbon', () => {
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
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
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), fakeLogger());
		adapter.register({
			id: 'test-cmd', name: 'Test', callback,
			ribbon: { icon: 'bot', title: 'Open', visibleByDefault: true },
		});
		capturedClickFn?.();
		expect(callback).toHaveBeenCalled();
	});

	it('register: opensView-only command invokes viewRegistry.openView on execute', async () => {
		const plugin = createFakePlugin();
		const views = fakeViews();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, views, fakeLogger());
		adapter.register({ id: 'x', name: 'X', opensView: 'MY_VIEW' });
		expect(plugin.addCommand).toHaveBeenCalledTimes(1);
		const commandCall = plugin.addCommand.mock.calls[0][0] as { callback: () => void };
		commandCall.callback();
		// Flush microtasks deterministically — no wall-clock delay.
		await Promise.resolve();
		await Promise.resolve();
		expect(views.openView).toHaveBeenCalledWith(plugin, 'MY_VIEW');
	});

	it('register: opensView + callback runs view open BEFORE user callback (awaited ordering)', async () => {
		const order: string[] = [];
		const plugin = createFakePlugin();
		let resolveOpen: (() => void) | undefined;
		const views: ViewRegistryPort = {
			registerAll: vi.fn(),
			openView: vi.fn(async () => {
				await new Promise<void>((r) => { resolveOpen = r; });
				order.push('view-open');
				return { kind: 'ok', value: undefined };
			}),
		};
		const userCallback = vi.fn(async () => { order.push('user-callback'); });
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, views, fakeLogger());
		adapter.register({ id: 'x', name: 'X', opensView: 'MY_VIEW', callback: userCallback });
		const commandCall = plugin.addCommand.mock.calls[0][0] as { callback: () => void };
		commandCall.callback();
		// userCallback must NOT fire until openView resolves.
		await Promise.resolve();
		expect(order).toEqual([]);
		expect(userCallback).not.toHaveBeenCalled();
		// Release openView.
		resolveOpen?.();
		await vi.waitFor(() => { expect(order).toEqual(['view-open', 'user-callback']); });
		expect(userCallback).toHaveBeenCalledTimes(1);
	});

	it('register: user callback still runs when openView rejects; error is logged', async () => {
		const logger = fakeLogger();
		const plugin = createFakePlugin();
		const views: ViewRegistryPort = {
			registerAll: vi.fn(),
			openView: vi.fn(async () => { throw new Error('view-not-registered'); }),
		};
		const userCallback = vi.fn();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, views, logger);
		adapter.register({ id: 'nav-cmd', name: 'Nav', opensView: 'MISSING', callback: userCallback });
		const commandCall = plugin.addCommand.mock.calls[0][0] as { callback: () => void };
		commandCall.callback();
		await vi.waitFor(() => { expect(userCallback).toHaveBeenCalledTimes(1); });
		expect(logger.error).toHaveBeenCalledWith(
			'ObsidianCommandAdapter',
			'openView failed for command "nav-cmd"',
			expect.any(Error),
		);
	});

	it('register: callback rejection is logged and swallowed (does not bubble)', async () => {
		const logger = fakeLogger();
		const plugin = createFakePlugin();
		const adapter = new ObsidianCommandAdapter(plugin as unknown as Plugin, fakeViews(), logger);
		adapter.register({
			id: 'throwing-cmd', name: 'Throws',
			callback: () => { throw new Error('user-boom'); },
		});
		const commandCall = plugin.addCommand.mock.calls[0][0] as { callback: () => void };
		expect(() => { commandCall.callback(); }).not.toThrow();
		await vi.waitFor(() => {
			expect(logger.error).toHaveBeenCalledWith(
				'ObsidianCommandAdapter',
				'callback failed for command "throwing-cmd"',
				expect.any(Error),
			);
		});
	});
});
