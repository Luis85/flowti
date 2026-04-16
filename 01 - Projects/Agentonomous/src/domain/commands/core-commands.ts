import type { CommandEntry } from './command-types.js';
import { VIEW_TYPE_HOMEPAGE } from '../views/view-types.js';

export const CORE_COMMANDS: readonly CommandEntry[] = [
	{
		id: 'open-homepage',
		name: 'Open homepage',
		opensView: VIEW_TYPE_HOMEPAGE,
		ribbon: {
			icon: 'bot',
			title: 'Open Agentonomous',
			visibleByDefault: true,
		},
	},
];
