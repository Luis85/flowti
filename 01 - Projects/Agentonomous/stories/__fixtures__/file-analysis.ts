export const jsonAnalysis = {
	fileName: 'agents.json',
	extension: '.json',
	sizeBytes: 4096,
	summary: {
		'Keys': 12,
		'Max depth': 3,
		'Format': 'JSON',
	},
} as const;

export const csvAnalysis = {
	fileName: 'activity-log.csv',
	extension: '.csv',
	sizeBytes: 28_672,
	summary: {
		'Rows': 342,
		'Columns': 8,
		'Delimiter': 'comma',
	},
} as const;

export const largeFileAnalysis = {
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
} as const;
