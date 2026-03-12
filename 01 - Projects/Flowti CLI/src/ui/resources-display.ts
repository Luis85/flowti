/**
 * resources-display.ts — Console renderers for project resources.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { ResourceSummary, FinancialSummary } from "../domain/resources/resource-types.js";

export function renderResourceList(resources: ResourceSummary[]): void {
	if (resources.length === 0) {
		log(`\n  ${DIM}No resources defined yet. Use "Add" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Resources (${resources.length})${RESET}\n`);
	for (const r of resources) {
		const typeTag = `${DIM}[${r.resourceType}]${RESET}`;
		const usage = r.amount > 0 ? ` ${consumed(r)} ${r.consumed}/${r.amount}` : "";
		log(`  ${CYAN}▸${RESET} ${r.name} ${typeTag}${usage} ${DIM}@ ${r.price}/u${RESET}`);
	}
	log();
}

function consumed(r: ResourceSummary): string {
	const pct = r.amount > 0 ? r.consumed / r.amount : 0;
	if (pct >= 0.9) return RED;
	if (pct >= 0.7) return YELLOW;
	return GREEN;
}

export function renderFinancialSummary(summary: FinancialSummary): void {
	log(`\n  ${BOLD}Financial Summary${RESET}\n`);
	log(`  Total Budget:   ${GREEN}${fmt(summary.totalBudget)}${RESET}`);
	log(`  Consumed:       ${fmt(summary.totalConsumed)}`);
	log(`  Remaining:      ${summary.totalRemaining >= 0 ? GREEN : RED}${fmt(summary.totalRemaining)}${RESET}`);
	log(`  Burn Rate:      ${fmtPct(summary.burnRate)}`);
	log();

	for (const [type, data] of Object.entries(summary.byType)) {
		if (data.budget === 0 && data.consumed === 0) continue;
		log(`  ${DIM}${type}:${RESET} budget ${fmt(data.budget)}, consumed ${fmt(data.consumed)}`);
	}
	log();
}

function fmt(n: number): string { return n.toFixed(2); }
function fmtPct(n: number): string { return `${(n * 100).toFixed(1)}%`; }

export function renderResourceAdded(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}
