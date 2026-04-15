import { describe, expect, it } from 'vitest';
import type { Plugin } from 'obsidian';
import { ViewRegistry } from '../../../src/infrastructure/obsidian/view-registry.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ViewRegistry', () => {
	it('registerAll() registers every view type with the plugin', () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({}) as never },
		]);
		registry.registerAll(plugin as unknown as Plugin, { ctx: true } as never);
		expect(plugin.registerView).toHaveBeenCalledWith('test-view', expect.any(Function));
	});

	it('openView() reveals an existing leaf if one exists', async () => {
		const plugin = createFakePlugin();
		const existing = { setViewState: () => Promise.resolve(), detach: () => {} };
		plugin.app.workspace.getLeavesOfType = (() => [existing]) as never;
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.revealLeaf).toHaveBeenCalledWith(existing);
	});

	it('openView() creates a new leaf when none exists', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'test-view', displayName: 'Test', icon: 'bot', defaultLocation: 'main', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
	});

	it('openView() throws for unknown type', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([]);
		await expect(registry.openView(plugin as unknown as Plugin, 'nope')).rejects.toThrow(/unknown/i);
	});

	it('openView() uses getLeftLeaf for left location', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'left-view', displayName: 'Left', icon: 'bot', defaultLocation: 'left', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'left-view');
		expect(plugin.app.workspace.getLeftLeaf).toHaveBeenCalled();
	});

	it('openView() uses getRightLeaf for right location', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry([
			{ type: 'right-view', displayName: 'Right', icon: 'bot', defaultLocation: 'right', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'right-view');
		expect(plugin.app.workspace.getRightLeaf).toHaveBeenCalled();
	});

	it('openView() falls back to getLeaf when getLeftLeaf returns null', async () => {
		const plugin = createFakePlugin();
		plugin.app.workspace.getLeftLeaf = (() => null) as never;
		const registry = new ViewRegistry([
			{ type: 'left-view', displayName: 'Left', icon: 'bot', defaultLocation: 'left', viewFactory: () => ({}) as never },
		]);
		await registry.openView(plugin as unknown as Plugin, 'left-view');
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
	});
});
