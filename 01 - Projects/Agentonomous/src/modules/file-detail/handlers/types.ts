export type FileAnalysis = {
	readonly fileName: string;
	readonly extension: string;
	readonly sizeBytes: number;
	readonly summary: Record<string, string | number>;
};

export type FileTypeHandler = {
	readonly extension: string;
	analyze(content: string, fileName: string): FileAnalysis;
};
