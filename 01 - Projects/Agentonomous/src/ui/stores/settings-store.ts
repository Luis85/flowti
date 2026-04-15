import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { isOk } from '../../domain/shared/result.js';

export const useSettingsStore = defineStore('settings', () => {
	const settings = ref<PluginSettings>(DEFAULT_SETTINGS);
	let port: SettingsPort | null = null;
	let unsub: Unsubscribe | null = null;

	async function hydrate(newPort: SettingsPort): Promise<void> {
		port = newPort;
		unsub?.();
		unsub = port.subscribe((s) => { settings.value = s; });
		const loaded = await port.load();
		if (isOk(loaded)) settings.value = loaded.value;
	}

	async function update(next: PluginSettings): Promise<void> {
		if (port === null) throw new Error('settings store not hydrated');
		const r = await port.save(next);
		if (isOk(r)) settings.value = next;
	}

	function dispose(): void {
		unsub?.();
		unsub = null;
		port = null;
	}

	return { settings, hydrate, update, dispose };
});
