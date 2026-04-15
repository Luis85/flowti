import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from '../../../src/infrastructure/obsidian/obsidian-settings-adapter.js';
import { DEFAULT_SETTINGS } from '../../../src/domain/settings/plugin-settings.js';
import { isOk } from '../../../src/domain/shared/result.js';
import { createFakePlugin } from './fake-plugin.js';

describe('ObsidianSettingsAdapter', () => {
	it('load() returns DEFAULT_SETTINGS when plugin data is null', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(DEFAULT_SETTINGS);
	});

	it('load() returns stored settings when valid', async () => {
		const plugin = createFakePlugin({ showRibbonIcon: false, defaultView: 'home' });
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value.showRibbonIcon).toBe(false);
	});

	it('load() returns DEFAULT_SETTINGS when stored data is invalid', async () => {
		const plugin = createFakePlugin({ showRibbonIcon: 'yes' });
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const r = await adapter.load();
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value).toEqual(DEFAULT_SETTINGS);
	});

	it('save() persists settings and notifies subscribers', async () => {
		const plugin = createFakePlugin(null);
		const adapter = new ObsidianSettingsAdapter(plugin as unknown as Plugin);
		const listener = vi.fn();
		adapter.subscribe(listener);
		const next = { showRibbonIcon: false, defaultView: 'home' as const };
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
		await adapter.save({ showRibbonIcon: false, defaultView: 'home' });
		expect(listener).not.toHaveBeenCalled();
	});
});
