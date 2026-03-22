/**
 * Renderer for process:list command output.
 */

import type { ProcessEntry } from "../../domain/processes/process-registry.js";
import type { Log } from "../../infrastructure/deps.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export interface ProcessListResultModel {
	readonly entries: ProcessEntry[];
}

export function renderProcessList(data: ProcessListResultModel, log: Log): void {
	if (data.entries.length === 0) {
		log(`\n  ${DIM}No running processes.${RESET}\n`);
		return;
	}
	log("");
	for (const e of data.entries) {
		const url = e.url ? ` ${DIM}${e.url}${RESET}` : "";
		log(`  ${e.type}/${e.name}  pid=${e.pid}${url}  since ${e.startedAt}`);
	}
	log("");
}
