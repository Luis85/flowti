/**
 * lifecycle-display.ts — Console renderers for lifecycle items.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { LifecycleRecord, LifecycleSummary, TransitionResult } from "../../domain/lifecycle/lifecycle-types.js";
import type { LifecycleTransitionRecord } from "../../infrastructure/types.js";

const STATE_COLORS: Record<string, string> = {
	// Terminal / done states
	archived: DIM, sunset: DIM, deprecated: DIM,
	// Active states
	execution: GREEN, growth: GREEN, release: GREEN,
	monitoring: CYAN, maturity: CYAN, testing: CYAN,
	// Early states
	inception: YELLOW, concept: YELLOW, ideation: YELLOW,
	planning: YELLOW, specification: YELLOW,
	// Transition states
	closing: RED, decline: RED,
};

export function renderLifecycleStatus(record: LifecycleRecord): void {
	const color = STATE_COLORS[record.currentState] ?? DIM;
	log(`\n  ${BOLD}${record.name}${RESET}`);
	log(`  Type: ${DIM}${record.entityType}${RESET}`);
	log(`  State: ${color}${record.currentState}${RESET}`);
	log(`  Transitions: ${record.history.length}`);
	if (record.lastTransitionDate) {
		log(`  Last transition: ${DIM}${record.lastTransitionDate}${RESET}`);
	}
	if (record.description) {
		log(`  ${DIM}${record.description}${RESET}`);
	}
	log();
}

export function renderTransitionHistory(history: LifecycleTransitionRecord[]): void {
	if (history.length === 0) {
		log(`\n  ${DIM}No transitions recorded yet.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Transition History (${history.length})${RESET}\n`);
	for (const h of history) {
		const fromColor = STATE_COLORS[h.from] ?? DIM;
		const toColor = STATE_COLORS[h.to] ?? DIM;
		log(`  ${DIM}${h.date}${RESET}  ${fromColor}${h.from}${RESET} → ${toColor}${h.to}${RESET}  ${DIM}${h.reason}${RESET}`);
	}
	log();
}

export function renderTransitionResult(result: TransitionResult): void {
	if (result.success) {
		const toColor = STATE_COLORS[result.to!] ?? DIM;
		log(`\n  ${GREEN}✓${RESET} Transitioned: ${result.from} → ${toColor}${result.to}${RESET}`);
	} else {
		log(`\n  ${RED}✗${RESET} ${result.error}`);
	}
}

export function renderLifecycleList(items: LifecycleSummary[]): void {
	if (items.length === 0) {
		log(`\n  ${DIM}No lifecycle items found.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Lifecycle Items (${items.length})${RESET}\n`);
	for (const item of items) {
		const color = STATE_COLORS[item.currentState] ?? DIM;
		const typeTag = `${DIM}[${item.entityType}]${RESET}`;
		log(`  ${item.name} ${typeTag} ${color}[${item.currentState}]${RESET} ${DIM}(${item.transitionCount} transitions)${RESET}`);
	}
	log();
}

export function renderLifecycleCreated(relPath: string): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}
