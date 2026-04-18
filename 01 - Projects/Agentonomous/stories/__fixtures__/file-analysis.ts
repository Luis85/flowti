import type { FileAnalysis } from '../../src/modules/file-detail/handlers/types.js';

export const jsonAnalysis: FileAnalysis = {
	fileName: 'agents.json',
	extension: '.json',
	sizeBytes: 4096,
	summary: {
		'Keys': 12,
		'Max depth': 3,
		'Format': 'JSON',
	},
};

export const csvAnalysis: FileAnalysis = {
	fileName: 'activity-log.csv',
	extension: '.csv',
	sizeBytes: 28_672,
	summary: {
		'Rows': 342,
		'Columns': 8,
		'Delimiter': 'comma',
	},
};

export const largeFileAnalysis: FileAnalysis = {
	fileName: 'world-state.json',
	extension: '.json',
	sizeBytes: 1_048_576,
	summary: {
		'Keys': 2847,
		'Max depth': 7,
		'Format': 'JSON',
		'Agents': 12,
		'Positions': 12,
		'Inventory slots': 48,
	},
};
