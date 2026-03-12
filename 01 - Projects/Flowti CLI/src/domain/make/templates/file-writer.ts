/**
 * file-writer.ts — File writer factory for scaffolding operations.
 */

import { writeFileAt, overwriteFileAt } from "../../../infrastructure/fs.js";
import type { IFileSystem } from "../../../infrastructure/types.js";

export interface FileWriter {
	/** Write a file at the given relative path. Returns true if file was created. */
	write(rel: string, content: string): boolean;
	/** Number of files successfully created so far. */
	readonly created: number;
}

export function createFileWriter(basePath: string, fs?: IFileSystem): FileWriter {
	const state = { created: 0 };
	return {
		write(rel: string, content: string): boolean {
			const ok = fs ? writeFileAt(basePath, rel, content, fs) : writeFileAt(basePath, rel, content);
			if (ok) state.created++;
			return ok;
		},
		get created(): number { return state.created; },
	};
}

/** Creates a writer that overwrites existing files (used for regeneration). */
export function createOverwriteFileWriter(basePath: string, fs?: IFileSystem): FileWriter {
	const state = { created: 0 };
	return {
		write(rel: string, content: string): boolean {
			const ok = fs ? overwriteFileAt(basePath, rel, content, fs) : overwriteFileAt(basePath, rel, content);
			if (ok) state.created++;
			return ok;
		},
		get created(): number { return state.created; },
	};
}
