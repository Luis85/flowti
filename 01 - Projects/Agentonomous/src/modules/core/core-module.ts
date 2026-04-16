import { defineModule } from '../../domain/shared/module.js';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings, type CoreSettings } from '../../domain/settings/plugin-settings.js';
import { CORE_COMMANDS } from '../../domain/commands/core-commands.js';

export const CoreModule = defineModule<CoreSettings>({
	id: 'core',
	name: 'Core',
	dependsOn: [],
	settingsKey: 'core',
	settingsDefaults: CORE_SETTINGS_DEFAULTS,
	validateSettings: validateCoreSettings,
	commands: CORE_COMMANDS,

	async init(ports, settings) {
		ports.logger.info('core', `Core module initialized (logLevel: ${settings.logLevel})`);
	},

	destroy() {},
});
