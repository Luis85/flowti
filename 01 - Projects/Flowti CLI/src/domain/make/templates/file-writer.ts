/**
 * file-writer.ts — File writer factory for scaffolding operations.
 */

import { writeFileAt } from "../../../infrastructure/fs.js";
import { log } from "../../../infrastructure/logger.js";
import { GREEN, RESET } from "../../../infrastructure/ui.js";

export interface WriteResult {
	created: number;
	write: (rel: string, content: string) => void;
	report: (label: string) => void;
}

export function createFileWriter(basePath: string): WriteResult {
	let created = 0;
	return {
		get created() { return created; },
		write(rel: string, content: string): void {
			if (writeFileAt(basePath, rel, content)) created++;
		},
		report(label: string): void {
			log(`  ${GREEN}✓${RESET} Created ${created} files (${label}).\n`);
		},
	};
}
