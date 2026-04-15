import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '../../../src/ui/stores/settings-store.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../../src/domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../../src/domain/settings/settings-port.js';
import { ok } from '../../../src/domain/shared/result.js';

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
});
