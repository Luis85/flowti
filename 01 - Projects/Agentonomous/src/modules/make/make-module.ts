import { defineModule } from '../../domain/shared/module.js';
import type { ModulePorts } from '../../domain/shared/module.js';
import { MAKE_DEFAULTS, validateMakeSettings, type MakeSettings } from './make-settings.js';
import { createMakeService, type MakeService } from './make-service.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const VIEW_TYPE_MAKE = 'agentonomous-make';

type ModuleState = {
	readonly ports: ModulePorts;
	service: MakeService;
	settings: MakeSettings;
};

let state: ModuleState | null = null;

export function getMakeService(): MakeService | null { return state?.service ?? null; }
export function getMakeSettings(): MakeSettings | null { return state?.settings ?? null; }

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
	onSettingsChange(next) {
		if (state === null) return;
		const prev = state.settings;
		const folderChanged =
			prev.typesFolder !== next.typesFolder ||
			prev.basesFolder !== next.basesFolder ||
			prev.defaultInstancesRoot !== next.defaultInstancesRoot;
		if (folderChanged) {
			const ports = state.ports;
			// Interface contract is synchronous; fire-and-forget is safe today because
			// destroy() and init() resolve in a single microtask with no real async work.
			void this.destroy();
			void this.init(ports, next);
		} else {
			// Favorites / enabled-flag changes: update settings in place, reuse service.
			state.settings = next;
		}
	},
	destroy() { state = null; return Promise.resolve(); },
});
