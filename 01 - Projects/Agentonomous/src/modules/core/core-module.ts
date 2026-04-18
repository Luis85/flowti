import { defineModule } from '../../domain/shared/module.js';
import { CORE_COMMANDS } from '../../domain/commands/core-commands.js';
import { VIEW_TYPE_HOMEPAGE } from '../../domain/views/view-types.js';
import enMessages from './locales/en.json' with { type: 'json' };

/**
 * The Core module owns the homepage view intent and the built-in commands.
 * Core *settings* (logLevel, locale, showRibbonIcon, defaultView) are owned
 * by PluginCore itself — that's a plugin-bootstrap concern, not a module
 * one — so this module does NOT declare a settingsKey.  PluginCore reserves
 * the `core` blob section and validates no module claims it.
 */
export const CoreModule = defineModule({
	id: 'core',
	name: 'Core',
	dependsOn: [],
	commands: CORE_COMMANDS,
	messages: { en: enMessages },
	views: [
		{
			type: VIEW_TYPE_HOMEPAGE,
			displayName: 'Agentonomous',
			icon: 'bot',
			defaultLocation: 'main',
		},
	],

	init(ports) {
		ports.logger.info('core', 'Core module initialized');
		return Promise.resolve();
	},

	destroy() {},
});
