import { defineModule } from '../../domain/shared/module.js';
import type { ModulePorts } from '../../domain/shared/module.js';
import { MAKE_DEFAULTS, validateMakeSettings, type MakeSettings } from './make-settings.js';
import { createMakeService, type MakeService } from './make-service.js';
import enMessages from './locales/en.json' with { type: 'json' };
import { VIEW_TYPE_MAKE } from '../../domain/views/view-types.js';
import type { EventMap } from '../../domain/shared/event-bus.js';

export { VIEW_TYPE_MAKE };

type ModuleState = {
	readonly ports: ModulePorts;
	service: MakeService;
	settings: MakeSettings;
};

let state: ModuleState | null = null;

export function getMakeService(): MakeService | null { return state?.service ?? null; }
export function getMakeSettings(): MakeSettings | null { return state?.settings ?? null; }

export type MakeEventHandlers = {
	readonly onTypeCreated?:      (payload: EventMap['make:type-created']) => void;
	readonly onTypeUpdated?:      (payload: EventMap['make:type-updated']) => void;
	readonly onTypeDeleted?:      (payload: EventMap['make:type-deleted']) => void;
	readonly onFavoriteToggled?:  (payload: EventMap['make:favorite-toggled']) => void;
	readonly onBaseRegenerated?:  (payload: EventMap['make:base-regenerated']) => void;
};

export function subscribeMakeEvents(handlers: MakeEventHandlers): () => void {
	if (state === null) return () => { /* no-op when module not initialised */ };
	const bus = state.ports.eventBus;
	const unsubs: Array<() => void> = [];
	if (handlers.onTypeCreated)     unsubs.push(bus.on('make:type-created',     (e) => { handlers.onTypeCreated!(e.payload); }));
	if (handlers.onTypeUpdated)     unsubs.push(bus.on('make:type-updated',     (e) => { handlers.onTypeUpdated!(e.payload); }));
	if (handlers.onTypeDeleted)     unsubs.push(bus.on('make:type-deleted',     (e) => { handlers.onTypeDeleted!(e.payload); }));
	if (handlers.onFavoriteToggled) unsubs.push(bus.on('make:favorite-toggled', (e) => { handlers.onFavoriteToggled!(e.payload); }));
	if (handlers.onBaseRegenerated) unsubs.push(bus.on('make:base-regenerated', (e) => { handlers.onBaseRegenerated!(e.payload); }));
	return () => { for (const u of unsubs) u(); };
}

export const MakeModule = defineModule<MakeSettings>({
	id: 'make',
	name: 'Make',
	dependsOn: ['core'],
	settingsKey: 'make',
	settingsDefaults: MAKE_DEFAULTS,
	validateSettings: validateMakeSettings,
	settingsSchema: {
		title: 'Make',
		fields: [
			{ kind: 'toggle', key: 'enabled', label: 'Enable Make' },
			{ kind: 'text', key: 'typesFolder', label: 'Types folder' },
			{ kind: 'text', key: 'basesFolder', label: 'Bases folder' },
			{ kind: 'text', key: 'defaultInstancesRoot', label: 'Default instances folder' },
		],
	},
	messages: { en: enMessages },
	views: [
		{ type: VIEW_TYPE_MAKE, displayName: 'Make', icon: 'hammer', defaultLocation: 'main' },
	],
	commands: [
		{ id: 'open-make', name: 'Open Make', opensView: VIEW_TYPE_MAKE,
		  ribbon: { icon: 'hammer', title: 'Make', visibleByDefault: true } },
	],
	async init(ports, settings) {
		if (state !== null) await this.destroy();
		// Service reads settings lazily via closure, so in-place updates to
		// state.settings (e.g. favorite toggles) propagate without rebuilding.
		const service = createMakeService(ports, () => {
			if (state === null) throw new Error('make-service called after destroy');
			return state.settings;
		});
		state = { ports, service, settings };
		ports.logger.info('make', 'Make module initialised');
	},
	async onSettingsChange(next): Promise<void> {
		if (state === null) return;
		const prev = state.settings;
		const folderChanged =
			prev.typesFolder !== next.typesFolder ||
			prev.basesFolder !== next.basesFolder ||
			prev.defaultInstancesRoot !== next.defaultInstancesRoot;
		if (folderChanged) {
			const ports = state.ports;
			await this.destroy();
			return this.init(ports, next).catch((err: unknown) => {
				state = null;
				ports.logger.error('make', `re-init after folder change failed: ${String(err)}`);
				return Promise.reject(err);
			});
		}
		// Favorites / enabled-flag changes: update settings in place, reuse service.
		state.settings = next;
	},
	destroy() { state = null; return Promise.resolve(); },
});
