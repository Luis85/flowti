import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from '../../../src/infrastructure/obsidian/obsidian-settings-adapter.js';
import { isOk } from '../../../src/domain/shared/result.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ObsidianSettingsAdapter', () => {
	it('load() returns ok(null) when plugin data is null', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toBeNull();
	});

	it('load() returns the raw stored data without validation', async () => {
		const stored = { showRibbonIcon: false, defaultView: 'home', logLevel: 'info' };
		const plugin = createFakePlugin(stored);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(stored);
	});

	it('load() returns invalid data as-is (no validation in adapter)', async () => {
		const stored = { showRibbonIcon: 'yes' };
		const plugin = createFakePlugin(stored);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(stored);
	});

	it('save() persists data and notifies subscribers', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const listener = vi.fn();
		adapter.subscribe(listener);
		const next = { showRibbonIcon: false, defaultView: 'home' as const, logLevel: 'info' as const };
		await adapter.save(next);
		expect(plugin.saveData).toHaveBeenCalledWith(next);
		expect(listener).toHaveBeenCalledWith(next);
	});

	it('subscribe() returns an unsubscribe that stops further notifications', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const listener = vi.fn();
		const unsub = adapter.subscribe(listener);
		unsub();
		await adapter.save({ showRibbonIcon: false, defaultView: 'home', logLevel: 'info' });
		expect(listener).not.toHaveBeenCalled();
	});
});
