/**
 * capa-display.ts — Console renderers for CAPA items.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../../infrastructure/ui.js";
import type { CAPASummary } from "../../domain/capa/capa-types.js";

const SEVERITY_COLORS: Record<string, string> = {
	critical: RED,
	high: YELLOW,
	medium: CYAN,
	low: DIM,
};

const STATUS_DONE: Set<string> = new Set(["closed", "verified"]);

export function renderCAPAList(items: CAPASummary[], log: (msg?: string) => void): void {
	if (items.length === 0) {
		log(`\n  ${DIM}No CAPA items defined yet. Use "Add" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}CAPA Log (${items.length})${RESET}\n`);
	for (const item of items) {
		const sevColor = SEVERITY_COLORS[item.severity] ?? DIM;
		const typeTag = `${DIM}[${item.capaType}]${RESET}`;
		const statusTag = STATUS_DONE.has(item.status) ? `${GREEN}[${item.status}]${RESET}` : `[${item.status}]`;
		const ownerTag = item.owner ? ` ${DIM}→ ${item.owner}${RESET}` : "";
		const dueTag = item.dueDate ? ` ${DIM}due ${item.dueDate}${RESET}` : "";
		log(`  ${sevColor}▸${RESET} ${CYAN}${item.id}${RESET} ${item.name} ${typeTag} ${statusTag}${ownerTag}${dueTag}`);
	}
	log();
}

export function renderCAPAAdded(relPath: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderCAPAUpdated(name: string, status: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Updated ${name} → ${status}`);
}
