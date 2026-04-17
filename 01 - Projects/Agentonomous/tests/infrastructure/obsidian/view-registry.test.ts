import { describe, expect, it } from 'vitest';
import type { Plugin } from 'obsidian';
import { ViewRegistry, type ViewRegistration } from '../../../src/infrastructure/obsidian/view-registry.js';
import { isErr } from '../../../src/domain/shared/result.js';
import { createFakePlugin } from './fake-plugin.js';

const FAKE_CTX = { ctx: true } as never;

function viewReg(overrides: Partial<ViewRegistration> & Pick<ViewRegistration, 'type' | 'defaultLocation'>): ViewRegistration {
	return {
		displayName: overrides.displayName ?? 'Test',
		icon: overrides.icon ?? 'bot',
		viewFactory: overrides.viewFactory ?? (() => ({}) as never),
		...overrides,
	};
}

describe('ViewRegistry', () => {
	it('registerAll() registers every view type with the plugin', () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'test-view', defaultLocation: 'main' }),
		]);
		expect(plugin.registerView).toHaveBeenCalledWith('test-view', expect.any(Function));
	});

	it('openView() reveals an existing leaf if one exists', async () => {
		const plugin = createFakePlugin();
		const existing = { setViewState: () => Promise.resolve(), detach: () => {} };
		plugin.app.workspace.getLeavesOfType = (() => [existing]) as never;
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'test-view', defaultLocation: 'main' }),
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.revealLeaf).toHaveBeenCalledWith(existing);
	});

	it('openView() creates a new leaf when none exists', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'test-view', defaultLocation: 'main' }),
		]);
		await registry.openView(plugin as unknown as Plugin, 'test-view');
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
	});

	it('openView() returns Err for unknown type', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry();
		const result = await registry.openView(plugin as unknown as Plugin, 'nope');
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error).toMatch(/unknown/i);
		}
	});

	it('openView() uses getLeftLeaf for left location', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'left-view', defaultLocation: 'left' }),
		]);
		await registry.openView(plugin as unknown as Plugin, 'left-view');
		expect(plugin.app.workspace.getLeftLeaf).toHaveBeenCalled();
	});

	it('openView() uses getRightLeaf for right location', async () => {
		const plugin = createFakePlugin();
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'right-view', defaultLocation: 'right' }),
		]);
		await registry.openView(plugin as unknown as Plugin, 'right-view');
		expect(plugin.app.workspace.getRightLeaf).toHaveBeenCalled();
	});

	it('openView() falls back to getLeaf when getLeftLeaf returns null', async () => {
		const plugin = createFakePlugin();
		plugin.app.workspace.getLeftLeaf = (() => null) as never;
		const registry = new ViewRegistry();
		registry.registerAll(plugin as unknown as Plugin, FAKE_CTX, [
			viewReg({ type: 'left-view', defaultLocation: 'left' }),
		]);
		await registry.openView(plugin as unknown as Plugin, 'left-view');
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
	});
});
