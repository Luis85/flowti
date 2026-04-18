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
	init(ports, settings) {
		if (state !== null) void this.destroy();
		// The service reads settings through a getter closure, so live in-place updates
		// to state.settings (e.g. favorite toggles) propagate without rebuilding.
		const currentSettings = { value: settings };
		const service = createMakeService(ports, () => (state?.settings ?? currentSettings.value));
		state = { ports, service, settings };
		ports.logger.info('make', 'Make module initialised');
		return Promise.resolve();
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
			void this.destroy();
			void this.init(ports, next);
		} else {
			// Favorites / enabled-flag changes: update settings in place, reuse existing service.
			// Service reads settings at the start of each call via a closure on `state.settings`,
			// so updating the reference propagates without a rebuild.
			state.settings = next;
		}
	},
	destroy() { state = null; return Promise.resolve(); },
});
