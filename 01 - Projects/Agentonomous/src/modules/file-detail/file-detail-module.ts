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
	settingsSchema: {
		title: 'File Detail',
		fields: [
			{
				kind: 'toggle',
				key: 'enabled',
				label: 'Enable File Detail view',
				description: 'Register the file-detail view as the handler for .json and .csv files.',
			},
		],
	},
	messages: { en: enMessages },
	views: [
		{
			type: VIEW_TYPE_FILE_DETAIL,
			displayName: 'File detail',
			icon: 'file-search',
			defaultLocation: 'right',
		},
	],

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
