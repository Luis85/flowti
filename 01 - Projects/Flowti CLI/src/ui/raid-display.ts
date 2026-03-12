/**
 * raid-display.ts — Console renderers for RAID log items.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { RAIDSummary } from "../domain/raid/raid-types.js";

const SEVERITY_COLORS: Record<string, string> = {
	critical: RED,
	high: YELLOW,
	medium: CYAN,
	low: DIM,
};

export function renderRAIDList(items: RAIDSummary[]): void {
	if (items.length === 0) {
		log(`\n  ${DIM}No RAID items defined yet. Use "Add" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}RAID Log (${items.length})${RESET}\n`);
	for (const item of items) {
		const sevColor = SEVERITY_COLORS[item.severity] ?? DIM;
		const typeTag = `${DIM}[${item.itemType}]${RESET}`;
		const statusTag = item.status === "closed" || item.status === "resolved" ? `${GREEN}[${item.status}]${RESET}` : `[${item.status}]`;
		const ownerTag = item.owner ? ` ${DIM}→ ${item.owner}${RESET}` : "";
		const dueTag = item.dueDate ? ` ${DIM}due ${item.dueDate}${RESET}` : "";
		log(`  ${sevColor}▸${RESET} ${item.name} ${typeTag} ${statusTag}${ownerTag}${dueTag}`);
	}
	log();
}

export function renderRAIDAdded(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderRAIDUpdated(name: string, status: string): void {
	log(`\n  ${GREEN}✓${RESET} Updated ${name} → ${status}`);
}
