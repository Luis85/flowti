/**
 * deliverables-display.ts — Console renderers for project deliverables.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { DeliverableSummary } from "../../domain/deliverables/deliverable-types.js";

const STATUS_COLORS: Record<string, string> = {
	done: GREEN,
	"in-progress": CYAN,
	review: YELLOW,
	blocked: RED,
	planned: DIM,
};

export function renderDeliverableList(deliverables: DeliverableSummary[]): void {
	if (deliverables.length === 0) {
		log(`\n  ${DIM}No deliverables defined yet. Use "Add Deliverable" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Deliverables (${deliverables.length})${RESET}\n`);
	for (const d of deliverables) {
		const color = STATUS_COLORS[d.status] ?? DIM;
		const dueTag = d.dueDate ? ` ${DIM}due ${d.dueDate}${RESET}` : "";
		const assigneeTag = d.assignee ? ` ${DIM}→ ${d.assignee}${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${d.name} ${color}[${d.status}]${RESET} ${d.completionPct}%${dueTag}${assigneeTag}`);
	}
	log();
}

export function renderDeliverableAdded(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderDeliverableUpdated(name: string, status: string): void {
	log(`\n  ${GREEN}✓${RESET} Updated ${name} → ${status}`);
}
