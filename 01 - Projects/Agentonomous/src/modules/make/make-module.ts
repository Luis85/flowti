import { defineModule } from '../../domain/shared/module.js';
import type { ModulePorts } from '../../domain/shared/module.js';
import { MAKE_DEFAULTS, validateMakeSettings, type MakeSettings } from './make-settings.js';
import { createMakeService, type MakeService } from './make-service.js';
import enMessages from './locales/en.json' with { type: 'json' };
import { VIEW_TYPE_MAKE } from '../../domain/views/view-types.js';
import type { EventMap } from '../../domain/shared/event-bus.js';
import type { WorkspacePort } from '../../domain/shared/workspace-port.js';

export { VIEW_TYPE_MAKE };

type ModuleState = {
	readonly ports: ModulePorts;
	service: MakeService;
	settings: MakeSettings;
};

let state: ModuleState | null = null;

export type MakeEventHandlers = {
	readonly onTypeCreated?:      (payload: EventMap['make:type-created']) => void;
	readonly onTypeUpdated?:      (payload: EventMap['make:type-updated']) => void;
	readonly onTypeDeleted?:      (payload: EventMap['make:type-deleted']) => void;
	readonly onFavoriteToggled?:  (payload: EventMap['make:favorite-toggled']) => void;
	readonly onBaseRegenerated?:  (payload: EventMap['make:base-regenerated']) => void;
	readonly onSettingsChanged?:  (payload: EventMap['make:settings-changed']) => void;
};

function subscribe(handlers: MakeEventHandlers): () => void {
	if (state === null) return () => { /* no-op when module not initialised */ };
	const bus = state.ports.eventBus;
	const unsubs: Array<() => void> = [];
	if (handlers.onTypeCreated)     unsubs.push(bus.on('make:type-created',     (e) => { handlers.onTypeCreated!(e.payload); }));
	if (handlers.onTypeUpdated)     unsubs.push(bus.on('make:type-updated',     (e) => { handlers.onTypeUpdated!(e.payload); }));
	if (handlers.onTypeDeleted)     unsubs.push(bus.on('make:type-deleted',     (e) => { handlers.onTypeDeleted!(e.payload); }));
	if (handlers.onFavoriteToggled) unsubs.push(bus.on('make:favorite-toggled', (e) => { handlers.onFavoriteToggled!(e.payload); }));
	if (handlers.onBaseRegenerated) unsubs.push(bus.on('make:base-regenerated', (e) => { handlers.onBaseRegenerated!(e.payload); }));
	if (handlers.onSettingsChanged) unsubs.push(bus.on('make:settings-changed', (e) => { handlers.onSettingsChanged!(e.payload); }));
	return () => { for (const u of unsubs) u(); };
}

export type MakeModuleState = {
	readonly service: MakeService;
	readonly settings: MakeSettings;
	readonly subscribe: (handlers: MakeEventHandlers) => () => void;
	readonly workspace: WorkspacePort;
};

export function getMakeModuleState(): MakeModuleState | null {
	if (state === null) return null;
	return { service: state.service, settings: state.settings, subscribe, workspace: state.ports.workspace };
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
		const service = createMakeService(ports, () => {
			if (state === null) throw new Error('make-service called after destroy');
			return state.settings;
		});
		state = { ports, service, settings };
		ports.logger.info('make', 'Make module initialised');
	},
	async onSettingsChange(next) {
		if (state === null) return;
		const prev = state.settings;
		const folderChanged =
			prev.typesFolder !== next.typesFolder ||
			prev.basesFolder !== next.basesFolder ||
			prev.defaultInstancesRoot !== next.defaultInstancesRoot;
		if (folderChanged) {
			const ports = state.ports;
			await this.destroy();
			// Task 2 used .catch() pattern instead of try/catch due to module-layer
			// ESLint rule banning TryStatement. Preserve that pattern here.
			return this.init(ports, next).catch((err: unknown) => {
				state = null;
				ports.logger.error('make', `re-init after folder change failed: ${String(err)}`);
				return Promise.reject(err);
			});
		}
		state.settings = next;
		state.ports.eventBus.emit('make:settings-changed', { settings: next });
	},
	destroy() { state = null; return Promise.resolve(); },
});
