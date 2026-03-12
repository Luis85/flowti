/**
 * timelog-display.ts — Console renderers for time-log entries.
 */

import { RESET, DIM, GREEN, CYAN, BOLD } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { TimeLogEntry, TimeLogSummary } from "../domain/timelog/timelog-types.js";

export function renderTimeLogList(entries: TimeLogEntry[]): void {
	if (entries.length === 0) {
		log(`\n  ${DIM}No time-log entries yet. Use "Log Time" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Time Log (${entries.length} entries)${RESET}\n`);
	for (const e of entries) {
		const catTag = e.category ? ` ${DIM}[${e.category}]${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${e.date} ${e.person} — ${e.hours}h${catTag} ${DIM}${e.task}${RESET}`);
	}
	log();
}

export function renderTimeLogSummary(summary: TimeLogSummary): void {
	log(`\n  ${BOLD}Time Log Summary${RESET}\n`);
	log(`  Total Hours: ${GREEN}${summary.totalHours}${RESET}\n`);

	if (Object.keys(summary.byPerson).length > 0) {
		log(`  ${BOLD}By Person${RESET}`);
		for (const [person, hours] of Object.entries(summary.byPerson).sort((a, b) => b[1] - a[1])) {
			log(`  ${CYAN}▸${RESET} ${person}: ${hours}h`);
		}
		log();
	}

	if (Object.keys(summary.byCategory).length > 0) {
		log(`  ${BOLD}By Category${RESET}`);
		for (const [cat, hours] of Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])) {
			log(`  ${CYAN}▸${RESET} ${cat}: ${hours}h`);
		}
		log();
	}
}

export function renderTimeLogAdded(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Logged: ${relPath}`);
}
