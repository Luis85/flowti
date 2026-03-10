/**
 * health-display.ts — Console display helpers for health dashboard.
 *
 * Pure display functions that render HealthSnapshot data with ANSI colors.
 * Extracted from health.ts to keep file sizes manageable.
 */

import { RESET, BOLD, DIM, GREEN, RED, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { HealthSnapshot, SecurityMetrics } from "../domain/health/health.js";
import type { TrendDelta } from "../domain/health/health-trends.js";

// ── Display helpers ──────────────────────────────────────────────────

function statusIcon(ok: boolean): string {
	return ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
}

function pctColor(pct: number, threshold = 80): string {
	if (pct >= threshold) return `${GREEN}${pct.toFixed(1)}%${RESET}`;
	if (pct >= threshold * 0.75) return `${YELLOW}${pct.toFixed(1)}%${RESET}`;
	return `${RED}${pct.toFixed(1)}%${RESET}`;
}

function displaySource(h: HealthSnapshot): void {
	if (!h.source) return;
	log(`  ${BOLD}Source${RESET}`);
	log(`    Files:          ${h.source.files} source, ${h.source.testFiles} test`);
	log(`    Components:     ${h.components}`);
	log();
}

function displayTests(tests: HealthSnapshot["tests"]): void {
	if (!tests) return;
	log(`  ${BOLD}Tests${RESET}  ${statusIcon(tests.failed === 0)}`);
	log(`    Total:          ${tests.total} (${tests.suites} suites)`);
	log(`    Passed:         ${GREEN}${tests.passed}${RESET}`);
	if (tests.failed > 0) log(`    Failed:         ${RED}${tests.failed}${RESET}`);
	log();
}

function displayCoverage(cov: HealthSnapshot["coverage"]): void {
	if (!cov) return;
	log(`  ${BOLD}Coverage${RESET}`);
	log(`    Lines:          ${pctColor(cov.lines)}`);
	log(`    Branches:       ${pctColor(cov.branches, 70)}`);
	log(`    Functions:      ${pctColor(cov.functions)}`);
	log();
}

function displayBuild(build: HealthSnapshot["build"]): void {
	if (!build) return;
	log(`  ${BOLD}Build${RESET}  ${statusIcon(build.success)}`);
	log(`    Duration:       ${(build.durationMs / 1000).toFixed(1)}s`);
	log();
}

function displayLint(lint: HealthSnapshot["lint"]): void {
	if (!lint) return;
	log(`  ${BOLD}Lint${RESET}  ${statusIcon(lint.errors === 0 && lint.warnings === 0)}`);
	log(`    Errors:         ${lint.errors === 0 ? `${GREEN}0${RESET}` : `${RED}${lint.errors}${RESET}`}`);
	log(`    Warnings:       ${lint.warnings === 0 ? `${GREEN}0${RESET}` : `${YELLOW}${lint.warnings}${RESET}`}`);
	log();
}

function displaySecurity(sec: SecurityMetrics | null): void {
	if (!sec) return;
	const ok = sec.critical === 0 && sec.high === 0;
	log(`  ${BOLD}Security${RESET}  ${statusIcon(ok)}`);
	log(`    Vulnerabilities: ${sec.total}`);
	if (sec.critical > 0) log(`    Critical:       ${RED}${sec.critical}${RESET}`);
	if (sec.high > 0) log(`    High:           ${RED}${sec.high}${RESET}`);
	if (sec.moderate > 0) log(`    Moderate:       ${YELLOW}${sec.moderate}${RESET}`);
	if (sec.low > 0) log(`    Low:            ${DIM}${sec.low}${RESET}`);
	log();
}

function displayGit(git: HealthSnapshot["git"]): void {
	if (!git) return;
	log(`  ${BOLD}Git${RESET}`);
	log(`    Branch:         ${git.branch}`);
	log(`    Status:         ${git.status === "clean" ? `${GREEN}clean${RESET}` : `${YELLOW}dirty${RESET}`}`);
	log();
}

function goodBadIndicator(ok: boolean, label: string): string {
	return ok ? `${GREEN}${label} ✓${RESET}` : `${RED}${label} ✗${RESET}`;
}

function goodWarnIndicator(ok: boolean, label: string): string {
	return ok ? `${GREEN}${label} ✓${RESET}` : `${YELLOW}${label} ~${RESET}`;
}

function buildSummaryIndicators(h: HealthSnapshot): string[] {
	const out: string[] = [];
	if (h.tests) out.push(goodBadIndicator(h.tests.failed === 0, "Tests"));
	if (h.coverage) out.push(goodWarnIndicator(h.coverage.lines >= 80, "Coverage"));
	if (h.build) out.push(goodBadIndicator(h.build.success, "Build"));
	if (h.lint) out.push(goodWarnIndicator(h.lint.errors === 0 && h.lint.warnings === 0, "Lint"));
	if (h.security) out.push(goodBadIndicator(h.security.critical === 0 && h.security.high === 0, "Security"));
	if (h.git) out.push(goodWarnIndicator(h.git.status === "clean", "Git"));
	return out;
}

// ── Public display functions ─────────────────────────────────────────

export function displayHealth(h: HealthSnapshot): void {
	log(`\n  ${BOLD}Project Health: ${h.name}${RESET}\n`);

	displaySource(h);
	displayTests(h.tests);
	displayCoverage(h.coverage);
	displayBuild(h.build);
	displayLint(h.lint);
	displaySecurity(h.security);
	displayGit(h.git);

	const indicators = buildSummaryIndicators(h);
	if (indicators.length > 0) {
		log(`  ${DIM}Summary:${RESET} ${indicators.join("  ")}`);
		log();
	}

	if (!h.tests && !h.coverage && !h.build && !h.lint) {
		log(`  ${DIM}No report data found. Run reports first to populate the dashboard.${RESET}\n`);
	}
}

export function formatTrendLine(deltas: TrendDelta[]): string {
	return deltas.slice(0, 5).map((d) => {
		const sign = d.delta > 0 ? "+" : "";
		const val = Number.isInteger(d.delta) ? `${sign}${d.delta}` : `${sign}${d.delta.toFixed(1)}`;
		const color = d.indicator === "▲" ? GREEN : d.indicator === "▼" ? YELLOW : DIM;
		return `${color}${d.indicator}${RESET} ${d.metric.split(".").pop()} ${DIM}${val}${RESET}`;
	}).join("  ");
}
