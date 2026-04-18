import { ref, readonly, onScopeDispose } from 'vue';
import type { MakeContext } from '../modules/make/make-context.js';
import { getMakeService, getMakeSettings, subscribeMakeEvents } from '../modules/make/make-module.js';
import type { MakeSettings } from '../modules/make/make-settings.js';

/**
 * Build a MakeContext for the Vue app. Must be called inside a Vue
 * setup-scope (or with an active effect scope) so the returned
 * settings$ ref is owned by the correct scope.
 *
 * Returns null if the Make module was not initialised (in which case
 * consumers should skip calling useMakeContext()).
 *
 * Note: onScopeDispose only fires when there is an active effect scope.
 * When called from app.ts at the top level (no active scope), the
 * subscription is not automatically cleaned up — but this is acceptable
 * because the app lives for the entire plugin lifecycle and is unmounted
 * via vue.unmount() which disposes all app-level effects.
 */
export function createMakeContext(): MakeContext | null {
	const service = getMakeService();
	const initialSettings = getMakeSettings();
	if (service === null || initialSettings === null) return null;
	const settings$ = ref<MakeSettings>(initialSettings);
	const unsubscribe = subscribeMakeEvents({
		onSettingsChanged: ({ settings }) => { settings$.value = settings; },
	});
	onScopeDispose(() => { unsubscribe(); });
	return {
		service,
		settings$: readonly(settings$),
		subscribe: subscribeMakeEvents,
	};
}
