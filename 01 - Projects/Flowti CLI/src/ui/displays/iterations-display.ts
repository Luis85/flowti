/**
 * iterations-display.ts — Console renderers for iteration management.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED } from "../../infrastructure/ui.js";
import type { IterationSummary, ScopeItem } from "../../domain/iterations/iteration-types.js";
import type { GateResult, GatedTransitionResult } from "../../domain/lifecycle/lifecycle-types.js";

const STATUS_COLORS: Record<string, string> = {
	new: DIM,
	planned: CYAN,
	ready: CYAN,
	"in-progress": GREEN,
	"in-review": CYAN,
	done: DIM,
	completed: DIM,
	cancelled: DIM,
};

export function renderIterationList(items: IterationSummary[], log: (msg?: string) => void): void {
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

function renderSection(title: string, items: string[], log: (msg?: string) => void): void {
	if (items.length === 0) return;
	log(`\n  ${BOLD}${title}${RESET}`);
	for (const line of items) log(`  ${DIM}▸${RESET} ${line}`);
}

export function renderScopeItems(items: ScopeItem[], log: (msg?: string) => void): void {
	if (items.length === 0) return;
	const done = items.filter((s) => s.done).length;
	log(`\n  ${BOLD}Scope${RESET} ${DIM}(${done}/${items.length})${RESET}`);
	for (let i = 0; i < items.length; i++) {
		const s = items[i];
		const check = s.done ? `${GREEN}[x]${RESET}` : `${DIM}[ ]${RESET}`;
		const text = s.done ? `${DIM}${s.text}${RESET}` : s.text;
		log(`  ${check} ${text}`);
	}
}

export function renderIterationDetail(item: IterationSummary, log: (msg?: string) => void): void {
	const color = STATUS_COLORS[item.status] ?? DIM;

	log(`\n  ${BOLD}Iteration #${item.number} — ${item.name}${RESET}\n`);
	log(`  ${DIM}Status:${RESET}  ${color}${item.status}${RESET}`);
	log(`  ${DIM}Period:${RESET}  ${item.startDate} → ${item.endDate}`);
	log(`  ${DIM}Goal:${RESET}    ${item.goal}`);
	if (item.capacity) log(`  ${DIM}Capacity:${RESET} ${item.capacity}`);

	renderSection("Resources", item.resources.map((r) => [r.name, r.role, r.allocation].filter(Boolean).join(" — ")), log);
	renderSection("Capacities", item.capacities.map((c) => `${c.label}: ${c.value}${c.unit ? ` ${c.unit}` : ""}`), log);
	renderScopeItems(item.scopeItems, log);
	renderSection("Agents", item.agents.map((a) => `${a.name} ${DIM}(${a.file})${RESET}`), log);
	log();
}

export function renderIterationCreated(relPath: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderIterationStarted(name: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Started: ${name}`);
}

export function renderIterationClosed(name: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Closed: ${name}`);
}

export function renderAgentAdded(agentName: string, iterationName: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Added agent "${agentName}" to ${iterationName}`);
}

export function renderResourceAdded(resourceName: string, iterationName: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Added resource need "${resourceName}" to ${iterationName}`);
}

export function renderEstimationAdded(label: string, iterationName: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Added estimation "${label}" to ${iterationName}`);
}

export function renderIterationAdvanced(name: string, phase: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Advanced "${name}" to ${phase}`);
}

export function renderPlanningHeader(item: IterationSummary, log: (msg?: string) => void): void {
	const color = STATUS_COLORS[item.status] ?? DIM;

	log(`\n  ${BOLD}Edit — #${item.number} ${item.name}${RESET}`);
	log(`  ${DIM}Status:${RESET}  ${color}${item.status}${RESET}`);
	log(`  ${DIM}Period:${RESET}  ${item.startDate || DIM + "(not set)" + RESET} → ${item.endDate || DIM + "(not set)" + RESET}`);
	log(`  ${DIM}Goal:${RESET}    ${item.goal || DIM + "(none)" + RESET}`);
	if (item.description) log(`  ${DIM}Description:${RESET} ${item.description}`);
	else log(`  ${DIM}Description:${RESET} ${DIM}(none)${RESET}`);
	log();
}

export function renderGateStatus(gates: { label: string; passed: boolean }[], log: (msg?: string) => void): void {
	if (gates.length === 0) return;
	log(`  ${BOLD}Quality Gates${RESET}`);
	for (const g of gates) {
		const icon = g.passed ? `${GREEN}✓${RESET}` : `${RED}○${RESET}`;
		log(`  ${icon} ${g.label}`);
	}
	log();
}

export function renderGateResults(results: GateResult[], log: (msg?: string) => void): void {
	for (const r of results) {
		const icon = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const msg = r.message ? ` — ${r.message}` : "";
		log(`  ${icon} ${r.gateId}${msg}`);
	}
}

export function renderAdvanceResult(result: GatedTransitionResult, log: (msg?: string) => void): void {
	if (result.success) {
		log(`\n  ${GREEN}✓${RESET} Transitioned: ${result.from} → ${result.to}`);
	} else {
		log(`\n  ${RED}✗${RESET} ${result.error}`);
	}
	if (result.gateResults && result.gateResults.length > 0) {
		log(`\n  ${BOLD}Gates${RESET}`);
		renderGateResults(result.gateResults, log);
	}
}
