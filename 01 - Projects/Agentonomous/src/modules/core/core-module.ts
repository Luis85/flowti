import { defineModule } from '../../domain/shared/module.js';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings, type CoreSettings } from '../../domain/settings/plugin-settings.js';
import { CORE_COMMANDS } from '../../domain/commands/core-commands.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const CoreModule = defineModule<CoreSettings>({
	id: 'core',
	name: 'Core',
	dependsOn: [],
	settingsKey: 'core',
	settingsDefaults: CORE_SETTINGS_DEFAULTS,
	validateSettings: validateCoreSettings,
	commands: CORE_COMMANDS,
	messages: { en: enMessages },

	init(ports, settings) {
		ports.logger.info('core', `Core module initialized (logLevel: ${settings.logLevel})`);
		return Promise.resolve();
	},

	destroy() {},
});
