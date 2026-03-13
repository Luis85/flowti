/**
 * iterations-display.ts — Console renderers for iteration management.
 */

import { RESET, DIM, GREEN, CYAN, BOLD } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { IterationSummary } from "../../domain/iterations/iteration-types.js";

const STATUS_COLORS: Record<string, string> = {
	"in-progress": GREEN,
	"in-review": CYAN,
	planned: CYAN,
	completed: DIM,
	cancelled: DIM,
};

export function renderIterationList(items: IterationSummary[]): void {
	if (items.length === 0) {
		log(`\n  ${DIM}No iterations defined yet. Use "Add" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Iterations (${items.length})${RESET}\n`);
	for (const item of items) {
		const color = STATUS_COLORS[item.status] ?? DIM;
		const statusTag = `${color}[${item.status}]${RESET}`;
		const dates = `${DIM}${item.startDate} → ${item.endDate}${RESET}`;
		log(`  ${color}▸${RESET} ${CYAN}#${item.number}${RESET} ${item.name} ${statusTag} ${dates}`);
	}
	log();
}

export function renderIterationDetail(item: IterationSummary): void {
	const color = STATUS_COLORS[item.status] ?? DIM;

	log(`\n  ${BOLD}Iteration #${item.number} — ${item.name}${RESET}\n`);
	log(`  ${DIM}Status:${RESET}  ${color}${item.status}${RESET}`);
	log(`  ${DIM}Period:${RESET}  ${item.startDate} → ${item.endDate}`);
	log(`  ${DIM}Goal:${RESET}    ${item.goal}`);
	if (item.capacity) log(`  ${DIM}Capacity:${RESET} ${item.capacity}`);

	if (item.resources.length > 0) {
		log(`\n  ${BOLD}Resources${RESET}`);
		for (const r of item.resources) {
			const parts = [r.name, r.role, r.allocation].filter(Boolean);
			log(`  ${DIM}▸${RESET} ${parts.join(" — ")}`);
		}
	}

	if (item.capacities.length > 0) {
		log(`\n  ${BOLD}Capacities${RESET}`);
		for (const c of item.capacities) {
			const unit = c.unit ? ` ${c.unit}` : "";
			log(`  ${DIM}▸${RESET} ${c.label}: ${c.value}${unit}`);
		}
	}

	if (item.agents.length > 0) {
		log(`\n  ${BOLD}Agents${RESET}`);
		for (const a of item.agents) {
			log(`  ${DIM}▸${RESET} ${a.name} ${DIM}(${a.file})${RESET}`);
		}
	}
	log();
}

export function renderIterationCreated(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderIterationStarted(name: string): void {
	log(`\n  ${GREEN}✓${RESET} Started: ${name}`);
}

export function renderIterationClosed(name: string): void {
	log(`\n  ${GREEN}✓${RESET} Closed: ${name}`);
}

export function renderAgentAttached(agentName: string, iterationName: string): void {
	log(`\n  ${GREEN}✓${RESET} Attached agent "${agentName}" to ${iterationName}`);
}

export function renderResourceAdded(resourceName: string, iterationName: string): void {
	log(`\n  ${GREEN}✓${RESET} Added resource "${resourceName}" to ${iterationName}`);
}

export function renderCapacityAdded(capacityLabel: string, iterationName: string): void {
	log(`\n  ${GREEN}✓${RESET} Added capacity "${capacityLabel}" to ${iterationName}`);
}

export function renderIterationAdvanced(name: string, phase: string): void {
	log(`\n  ${GREEN}✓${RESET} Advanced "${name}" to ${phase}`);
}
