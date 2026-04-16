import type { FileAnalysis, FileTypeHandler } from './types.js';

function calcDepth(value: unknown, current = 0): number {
	if (typeof value !== 'object' || value === null) return current;
	const entries = Array.isArray(value) ? value as unknown[] : Object.values(value as Record<string, unknown>);
	if (entries.length === 0) return current + 1;
	return Math.max(...entries.map((v) => calcDepth(v, current + 1)));
}

export const jsonHandler: FileTypeHandler = {
	extension: 'json',
	analyze(content: string, fileName: string): FileAnalysis {
		const sizeBytes = new TextEncoder().encode(content).length;
		let parsed: unknown;
		try {
			parsed = JSON.parse(content) as unknown;
		} catch {
			return { fileName, extension: 'json', sizeBytes, summary: { 'Type': 'invalid' } };
		}

		const type = Array.isArray(parsed)
			? 'array'
			: typeof parsed === 'object' && parsed !== null
				? 'object'
				: typeof parsed;

		const summary: Record<string, string | number> = { 'Type': type };

		if (type === 'object') {
			summary['Key count'] = Object.keys(parsed as Record<string, unknown>).length;
		}
		if (type === 'array') {
			summary['Item count'] = (parsed as unknown[]).length;
		}
		summary['Depth'] = calcDepth(parsed);

		return { fileName, extension: 'json', sizeBytes, summary };
	},
};
