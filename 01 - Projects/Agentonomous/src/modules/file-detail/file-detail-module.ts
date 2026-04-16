import './file-detail-events.js';
import { defineModule } from '../../domain/shared/module.js';
import { FILE_DETAIL_DEFAULTS, validateFileDetailSettings, type FileDetailSettings } from './file-detail-settings.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const VIEW_TYPE_FILE_DETAIL = 'agentonomous-file-detail';

export const FileDetailModule = defineModule<FileDetailSettings>({
	id: 'file-detail',
	name: 'File Detail',
	dependsOn: ['core'],
	settingsKey: 'fileDetail',
	settingsDefaults: FILE_DETAIL_DEFAULTS,
	validateSettings: validateFileDetailSettings,
	messages: { en: enMessages },

	extensions: [
		{ ext: 'csv', viewType: VIEW_TYPE_FILE_DETAIL },
		{ ext: 'json', viewType: VIEW_TYPE_FILE_DETAIL },
	],

	init(ports, settings) {
		if (!settings.enabled) {
			ports.logger.info('file-detail', 'File Detail module disabled by settings');
			return Promise.resolve();
		}
		ports.logger.info('file-detail', 'File Detail module initialized');
		return Promise.resolve();
	},

	destroy() {},
});
