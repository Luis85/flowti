import { ref, readonly, onScopeDispose, getCurrentScope } from 'vue';
import type { MakeContext } from '../modules/make/make-context.js';
import { getMakeModuleState } from '../modules/make/make-module.js';
import type { MakeSettings } from '../modules/make/make-settings.js';

/**
 * Build a MakeContext for the Vue app. Usable both inside an effect
 * scope (where onScopeDispose auto-unsubscribes) and at the top level
 * of app bootstrap (where no scope exists; cleanup rides on vue.unmount).
 *
 * Returns null if the Make module was not initialised (in which case
 * consumers should skip calling useMakeContext()).
 */
export function createMakeContext(): MakeContext | null {
	const moduleState = getMakeModuleState();
	if (moduleState === null) return null;
	const settings$ = ref<MakeSettings>(moduleState.settings);
	const unsubscribe = moduleState.subscribe({
		onSettingsChanged: ({ settings }) => { settings$.value = settings; },
	});
	if (getCurrentScope() !== undefined) onScopeDispose(() => { unsubscribe(); });
	return {
		service: moduleState.service,
		settings$: readonly(settings$),
		subscribe: moduleState.subscribe,
		workspace: moduleState.workspace,
	};
}
