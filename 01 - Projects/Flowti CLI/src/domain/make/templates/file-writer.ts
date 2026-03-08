/**
 * file-writer.ts — File writer factory for scaffolding operations.
 */

import { writeFileAt } from "../../../infrastructure/fs.js";
import { log } from "../../../infrastructure/logger.js";
import { GREEN, RESET } from "../../../infrastructure/ui.js";

export interface FileWriter {
	/** Write a file at the given relative path. Returns true if file was created. */
	write(rel: string, content: string): boolean;
	/** Number of files successfully created so far. */
	readonly created: number;
	/** Log a summary line showing the count of created files. */
	report(label: string): void;
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
		report(label: string): void {
			log(`  ${GREEN}✓${RESET} Created ${state.created} files (${label}).\n`);
		},
	};
}
