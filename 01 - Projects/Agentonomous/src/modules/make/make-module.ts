import { defineModule } from '../../domain/shared/module.js';
import type { ModulePorts } from '../../domain/shared/module.js';
import { MAKE_DEFAULTS, validateMakeSettings, type MakeSettings } from './make-settings.js';
import { createMakeService, type MakeService } from './make-service.js';
import enMessages from './locales/en.json' with { type: 'json' };
import { VIEW_TYPE_MAKE } from '../../domain/views/view-types.js';
import type { EventMap } from '../../domain/shared/event-bus.js';
import type { WorkspacePort } from '../../domain/shared/workspace-port.js';
import type { LoggerPort } from '../../domain/shared/logger-port.js';

export { VIEW_TYPE_MAKE };

type ModuleState = {
	readonly ports: ModulePorts;
	service: MakeService;
	settings: MakeSettings;
};

let state: ModuleState | null = null;

let navigateHandler: ((path: string) => void) | null = null;

export function setMakeNavigateHandler(fn: (path: string) => void): void {
	navigateHandler = fn;
}

export function clearMakeNavigateHandler(): void {
	navigateHandler = null;
}

function navigate(path: string): void {
	if (navigateHandler !== null) navigateHandler(path);
}

export type MakeEventHandlers = {
	readonly onTypeCreated?:              (payload: EventMap['make:type-created']) => void;
	readonly onTypeUpdated?:              (payload: EventMap['make:type-updated']) => void;
	readonly onTypeDeleted?:              (payload: EventMap['make:type-deleted']) => void;
	readonly onInstanceCreated?:          (payload: EventMap['make:instance-created']) => void;
	readonly onInstanceDeleted?:          (payload: EventMap['make:instance-deleted']) => void;
	readonly onOrphanDeleted?:            (payload: EventMap['make:orphan-deleted']) => void;
	readonly onInstancesDeletedBatch?:    (payload: EventMap['make:instances-deleted-batch']) => void;
	readonly onInstancesMoved?:           (payload: EventMap['make:instances-moved']) => void;
	readonly onFavoriteToggled?:          (payload: EventMap['make:favorite-toggled']) => void;
	readonly onBaseRegenerated?:          (payload: EventMap['make:base-regenerated']) => void;
	readonly onSettingsChanged?:          (payload: EventMap['make:settings-changed']) => void;
};

type HandlerBinding = { readonly [K in keyof MakeEventHandlers]-?: [K, keyof EventMap] }[keyof MakeEventHandlers];

const HANDLER_BINDINGS: readonly HandlerBinding[] = [
	['onTypeCreated',             'make:type-created'],
	['onTypeUpdated',             'make:type-updated'],
	['onTypeDeleted',             'make:type-deleted'],
	['onInstanceCreated',         'make:instance-created'],
	['onInstanceDeleted',         'make:instance-deleted'],
	['onOrphanDeleted',           'make:orphan-deleted'],
	['onInstancesDeletedBatch',   'make:instances-deleted-batch'],
	['onInstancesMoved',          'make:instances-moved'],
	['onFavoriteToggled',         'make:favorite-toggled'],
	['onBaseRegenerated',         'make:base-regenerated'],
	['onSettingsChanged',         'make:settings-changed'],
];

function subscribe(handlers: MakeEventHandlers): () => void {
	if (state === null) return () => { /* no-op when module not initialised */ };
	const bus = state.ports.eventBus;
	const unsubs: Array<() => void> = [];
	for (const [handlerKey, eventKey] of HANDLER_BINDINGS) {
		const handler = handlers[handlerKey];
		if (handler === undefined) continue;
		unsubs.push(bus.on(eventKey, (e) => { (handler as (p: unknown) => void)(e.payload); }));
	}
	return () => { for (const u of unsubs) u(); };
}

export type MakeModuleState = {
	readonly service: MakeService;
	readonly settings: MakeSettings;
	readonly subscribe: (handlers: MakeEventHandlers) => () => void;
	readonly workspace: WorkspacePort;
	readonly logger: LoggerPort;
};

export function getMakeModuleState(): MakeModuleState | null {
	if (state === null) return null;
	return { service: state.service, settings: state.settings, subscribe, workspace: state.ports.workspace, logger: state.ports.logger };
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
			{ kind: 'folder', key: 'typesFolder', label: 'Types folder' },
			{ kind: 'folder', key: 'basesFolder', label: 'Bases folder' },
			{ kind: 'folder', key: 'defaultInstancesRoot', label: 'Default instances folder' },
		],
	},
	messages: { en: enMessages },
	views: [
		{ type: VIEW_TYPE_MAKE, displayName: 'Make', icon: 'hammer', defaultLocation: 'main' },
	],
	commands: [
		{ id: 'open-make', name: 'Open Make', opensView: VIEW_TYPE_MAKE,
		  ribbon: { icon: 'hammer', title: 'Make', visibleByDefault: true } },
		{ id: 'make-create-type', name: 'Create new type', opensView: VIEW_TYPE_MAKE,
		  callback: () => { navigate('/make/types/new'); } },
		{ id: 'make-browse-types', name: 'Browse types', opensView: VIEW_TYPE_MAKE,
		  callback: () => { navigate('/make/types'); } },
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
