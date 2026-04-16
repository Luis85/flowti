import type { FileAnalysis, FileTypeHandler } from './types.js';

export const csvHandler: FileTypeHandler = {
	extension: 'csv',
	analyze(content: string, fileName: string): FileAnalysis {
		const lines = content.split('\n').filter((l) => l.trim().length > 0);
		const header = lines[0] !== undefined ? lines[0].split(',').map((c) => c.trim()) : [];
		return {
			fileName,
			extension: 'csv',
			sizeBytes: new TextEncoder().encode(content).length,
			summary: {
				'Row count': Math.max(0, lines.length - 1),
				'Column count': header.length,
				'Columns': header.join(', '),
			},
		};
	},
};
