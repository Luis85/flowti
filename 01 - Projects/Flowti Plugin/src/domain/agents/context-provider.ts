/**
 * Context provider interface — tracks active file and computes diffs.
 * Pure domain type — no I/O dependencies.
 */

export interface FileContext {
	readonly path: string;
	readonly contentHash: string;
	readonly content: string;
}

export interface FileDiff {
	readonly path: string;
	readonly previousHash: string;
	readonly currentHash: string;
	readonly diff: string;
}

export interface IContextProvider {
	getActiveFileContext(): FileContext | null;
	getDiff(sinceHash: string): FileDiff | null;
	onFileChanged(callback: (ctx: FileContext) => void): () => void;
	dispose(): void;
}
