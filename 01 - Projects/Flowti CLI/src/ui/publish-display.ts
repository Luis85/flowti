/**
 * publish-display.ts — Console display helpers for publish commands.
 *
 * Pure renderers used as dataResponse callbacks by publish.controller.ts.
 */

import { log } from "../infrastructure/logger.js";
import { RESET, DIM, CYAN, GREEN, RED, YELLOW, BOLD } from "../infrastructure/ui.js";
import type { GateResult } from "../domain/health/quality-gate.js";

// ── Data models ──────────────────────────────────────────────────────

export interface DryRunModel {
	buildCmd: string;
	testCmd: string;
	outDir: string;
	artifacts: string[];
	endpoints: Array<{ name: string; path: string }>;
}

export interface GateBlockedModel {
	message: string;
	hint: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderDryRun(data: DryRunModel): void {
	log(`\n  ${CYAN}Dry run — publish preview${RESET}\n`);
	log(`  ${DIM}Build command:${RESET}  ${data.buildCmd}`);
	log(`  ${DIM}Test command:${RESET}   ${data.testCmd}`);
	log(`  ${DIM}Output dir:${RESET}     ${data.outDir}`);
	if (data.artifacts.length > 0) log(`  ${DIM}Artifacts:${RESET}      ${data.artifacts.join(", ")}`);
	if (data.endpoints.length > 0) {
		log(`\n  ${DIM}Endpoints:${RESET}`);
		for (const ep of data.endpoints) log(`    ${DIM}•${RESET} ${ep.name} → ${ep.path}`);
	} else {
		log(`\n  ${DIM}No endpoints configured.${RESET}`);
	}
	log();
}

export function renderGateResult(data: GateResult): void {
	const status = data.passed
		? `${GREEN}${BOLD}PASSED${RESET}`
		: `${RED}${BOLD}FAILED${RESET}`;
	log(`\n  ${BOLD}Quality Gates:${RESET} ${status}\n`);
	if (data.scoreCheck) {
		const icon = data.scoreCheck.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		log(`  ${icon} Score ≥ ${data.scoreCheck.required}  ${DIM}(actual: ${data.scoreCheck.actual})${RESET}`);
	}
	for (const r of data.rules) {
		const icon = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const actual = r.actual !== null ? r.actual : `${YELLOW}n/a${RESET}`;
		log(`  ${icon} ${r.rule.metric} ${r.rule.operator} ${r.rule.value}  ${DIM}(actual: ${actual})${RESET}`);
	}
	log();
}

export function renderGateBlocked(data: GateBlockedModel): void {
	log(`  ${RED}${data.message}${RESET}`);
	log(`  ${DIM}${data.hint}${RESET}\n`);
}
