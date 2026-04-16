import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '../../../src/ui/stores/settings-store.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../../src/domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../../src/domain/settings/settings-port.js';
import { ok } from '../../../src/domain/shared/result.js';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';

function makeFakePort(initial: PluginSettings = DEFAULT_SETTINGS): SettingsPort & { listenerCount: () => number } {
	let current = initial;
	const listeners = new Set<(s: PluginSettings) => void>();
	return {
		load: async () => ok(current),
		save: async (s) => { current = s; for (const l of listeners) l(s); return ok(undefined); },
		subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
		listenerCount: () => listeners.size,
	};
}

describe('useSettingsStore', () => {
	it('hydrate() loads settings from the port', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort({ showRibbonIcon: false, defaultView: 'home' });
		const store = useSettingsStore();
		await store.hydrate(port);
		expect(store.settings.showRibbonIcon).toBe(false);
	});

	it('update() writes settings through the port and reflects the change', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		await store.update({ showRibbonIcon: false, defaultView: 'home' });
		expect(store.settings.showRibbonIcon).toBe(false);
	});

	it('subscribes to port changes and updates state reactively', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		await port.save({ showRibbonIcon: false, defaultView: 'home' });
		expect(store.settings.showRibbonIcon).toBe(false);
	});

	it('hydrate() called twice unsubscribes the first listener', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		expect(port.listenerCount()).toBe(1);
		await store.hydrate(port);
		expect(port.listenerCount()).toBe(1);
	});

	it('dispose() removes the port subscription', async () => {
		setActivePinia(createPinia());
		const port = makeFakePort();
		const store = useSettingsStore();
		await store.hydrate(port);
		expect(port.listenerCount()).toBe(1);
		store.dispose();
		expect(port.listenerCount()).toBe(0);
	});

	it('update() throws when called before hydrate()', async () => {
		setActivePinia(createPinia());
		const store = useSettingsStore();
		await expect(store.update({ showRibbonIcon: false, defaultView: 'home' })).rejects.toThrow(/not hydrated/);
	});

	it('update() does not mutate state when port.save returns err', async () => {
		setActivePinia(createPinia());
		const port: SettingsPort = {
			load: async () => ok(DEFAULT_SETTINGS),
			save: vi.fn(async () => ({ kind: 'err' as const, error: 'disk full' })),
			subscribe: () => () => {},
		};
		const store = useSettingsStore();
		await store.hydrate(port);
		const before = { ...store.settings };
		await store.update({ showRibbonIcon: false, defaultView: 'home' });
		expect(store.settings).toEqual(before);
	});

	it('update() emits error on bus when port.save returns err', async () => {
		setActivePinia(createPinia());
		const bus = createEventBus();
		const errorListener = vi.fn();
		bus.on('error', errorListener);
		const port: SettingsPort = {
			load: async () => ok(DEFAULT_SETTINGS),
			save: async () => ({ kind: 'err' as const, error: 'disk full' }),
			subscribe: () => () => {},
		};
		const store = useSettingsStore();
		await store.hydrate(port, bus);
		await store.update({ showRibbonIcon: false, defaultView: 'home' });
		expect(errorListener).toHaveBeenCalledOnce();
		expect(errorListener.mock.calls[0][0].payload.code).toBe('SETTINGS_SAVE_FAILED');
	});
});
