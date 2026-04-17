import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import { CORE_SETTINGS_DEFAULTS, type CoreSettings, validateCoreSettings } from '../../domain/settings/plugin-settings.js';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { isOk } from '../../domain/shared/result.js';
import { invariant } from '../../domain/shared/utils/invariant.js';
import type { EventBus } from '../../domain/shared/event-bus.js';

const CORE_SECTION = 'core';

export const useSettingsStore = defineStore('settings', () => {
	const settings = ref<CoreSettings>(CORE_SETTINGS_DEFAULTS);
	let port: SettingsPort | null = null;
	let bus: EventBus | null = null;
	let unsub: Unsubscribe | null = null;

	async function hydrate(newPort: SettingsPort, newBus?: EventBus): Promise<void> {
		port = newPort;
		bus = newBus ?? null;
		unsub?.();
		const capturedPort = newPort;
		const loaded = await capturedPort.loadSection(CORE_SECTION);
		// Guard: dispose() may have been called while loadSection() was in flight
		if (port !== capturedPort) return;
		if (isOk(loaded)) {
			const validated = validateCoreSettings(loaded.value);
			if (isOk(validated)) settings.value = validated.value;
		}
		unsub = capturedPort.subscribe((raw) => {
			const section = extractSection(raw, CORE_SECTION);
			const validated = validateCoreSettings(section);
			if (isOk(validated)) settings.value = validated.value;
		});
	}

	async function update(next: CoreSettings): Promise<void> {
		invariant(port !== null, 'settings store not hydrated');
		const r = await port.saveSection(CORE_SECTION, next);
		if (isOk(r)) {
			settings.value = next;
		} else {
			bus?.emit('error', {
				code: 'SETTINGS_SAVE_FAILED',
				message: r.error,
				source: 'settings-store',
				severity: 'user',
			});
		}
	}

	function dispose(): void {
		unsub?.();
		unsub = null;
		port = null;
		bus = null;
	}

	return { settings, hydrate, update, dispose };
});

function extractSection(blob: unknown, key: string): unknown {
	if (typeof blob !== 'object' || blob === null || Array.isArray(blob)) return null;
	return (blob as Record<string, unknown>)[key];
}
