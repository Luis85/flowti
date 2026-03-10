/**
 * file-writer.ts — File writer factory for scaffolding operations.
 */

import { writeFileAt } from "../../../infrastructure/fs.js";

export interface FileWriter {
	/** Write a file at the given relative path. Returns true if file was created. */
	write(rel: string, content: string): boolean;
	/** Number of files successfully created so far. */
	readonly created: number;
}

export function createFileWriter(basePath: string): FileWriter {
	const state = { created: 0 };
	return {
		write(rel: string, content: string): boolean {
			const ok = writeFileAt(basePath, rel, content);
			if (ok) state.created++;
			return ok;
		},
		get created(): number { return state.created; },
	};
}
