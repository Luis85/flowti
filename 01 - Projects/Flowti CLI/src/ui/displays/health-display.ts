/**
 * health-display.ts — Console display helpers for health dashboard.
 *
 * Pure display functions that render HealthSnapshot data with ANSI colors.
 * Extracted from health.ts to keep file sizes manageable.
 */

import { RESET, BOLD, DIM, GREEN, RED, YELLOW } from "../../infrastructure/ui.js";
import type { HealthSnapshot, SecurityMetrics } from "../../domain/health/health.js";
import type { HealthScore } from "../../domain/health/health-scoring.js";
import type { TrendDelta, StoredSnapshot } from "../../domain/health/health-trends.js";
import type { DebtEstimate, DebtItem } from "../../domain/health/tech-debt.js";

// ── Display helpers ──────────────────────────────────────────────────

function statusIcon(ok: boolean): string {
	return ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
}

function pctColor(pct: number, threshold = 80): string {
	if (pct >= threshold) return `${GREEN}${pct.toFixed(1)}%${RESET}`;
	if (pct >= threshold * 0.75) return `${YELLOW}${pct.toFixed(1)}%${RESET}`;
	return `${RED}${pct.toFixed(1)}%${RESET}`;
}

function displaySource(h: HealthSnapshot, log: (msg?: string) => void): void {
	if (!h.source) return;
	log(`  ${BOLD}Source${RESET}`);
	log(`    Files:          ${h.source.files} source, ${h.source.testFiles} test`);
	log(`    Components:     ${h.components}`);
	log();
}

function displayTests(tests: HealthSnapshot["tests"], log: (msg?: string) => void): void {
	if (!tests) return;
	log(`  ${BOLD}Tests${RESET}  ${statusIcon(tests.failed === 0)}`);
	log(`    Total:          ${tests.total} (${tests.suites} suites)`);
	log(`    Passed:         ${GREEN}${tests.passed}${RESET}`);
	if (tests.failed > 0) log(`    Failed:         ${RED}${tests.failed}${RESET}`);
	log();
}

function displayCoverage(cov: HealthSnapshot["coverage"], log: (msg?: string) => void): void {
	if (!cov) return;
	log(`  ${BOLD}Coverage${RESET}`);
	log(`    Lines:          ${pctColor(cov.lines)}`);
	log(`    Branches:       ${pctColor(cov.branches, 70)}`);
	log(`    Functions:      ${pctColor(cov.functions)}`);
	log();
}

function displayBuild(build: HealthSnapshot["build"], log: (msg?: string) => void): void {
	if (!build) return;
	log(`  ${BOLD}Build${RESET}  ${statusIcon(build.success)}`);
	log(`    Duration:       ${(build.durationMs / 1000).toFixed(1)}s`);
	log();
}

function displayLint(lint: HealthSnapshot["lint"], log: (msg?: string) => void): void {
	if (!lint) return;
	log(`  ${BOLD}Lint${RESET}  ${statusIcon(lint.errors === 0 && lint.warnings === 0)}`);
	log(`    Errors:         ${lint.errors === 0 ? `${GREEN}0${RESET}` : `${RED}${lint.errors}${RESET}`}`);
	log(`    Warnings:       ${lint.warnings === 0 ? `${GREEN}0${RESET}` : `${YELLOW}${lint.warnings}${RESET}`}`);
	log();
}

function displaySecurity(sec: SecurityMetrics | null, log: (msg?: string) => void): void {
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

function displayGit(git: HealthSnapshot["git"], log: (msg?: string) => void): void {
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

export function displayHealth(h: HealthSnapshot, log: (msg?: string) => void): void {
	log(`\n  ${BOLD}Project Health: ${h.name}${RESET}\n`);

	displaySource(h, log);
	displayTests(h.tests, log);
	displayCoverage(h.coverage, log);
	displayBuild(h.build, log);
	displayLint(h.lint, log);
	displaySecurity(h.security, log);
	displayGit(h.git, log);

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

// ── Typed data models for controller responses ──────────────────────

export interface HealthViewModel extends HealthSnapshot {
	score: HealthScore;
	trend: TrendDelta[];
}

export interface SnapshotSavedModel {
	relativePath: string;
}

// ── Renderers (used as dataResponse callbacks) ──────────────────────

export function renderHealthDashboard(data: HealthViewModel, log: (msg?: string) => void): void {
	displayHealth(data, log);
	log(`  ${BOLD}Score:${RESET} ${data.score.overall}/100 (${data.score.grade})`);
	if (data.trend.length > 0) {
		log(`  ${DIM}Trend:${RESET} ${formatTrendLine(data.trend)}`);
	}
	log();
}

export function renderSnapshotSaved(data: SnapshotSavedModel, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Snapshot saved: ${data.relativePath}\n`);
}

export function renderHealthHistory(data: StoredSnapshot[], log: (msg?: string) => void): void {
	if (data.length === 0) {
		log(`\n  ${DIM}No health snapshots found. Run: flowti health:snapshot${RESET}\n`);
		return;
	}
	log(`\n  ${BOLD}Health History${RESET} (${data.length} snapshot${data.length === 1 ? "" : "s"})\n`);
	for (const entry of data.slice(0, 10)) {
		const date = entry.timestamp.replace("T", " ").substring(0, 19);
		log(`  ${DIM}${date}${RESET}  ${entry.score.grade} (${entry.score.overall}/100)  ${DIM}tests:${entry.snapshot.tests?.total ?? "?"}${RESET}`);
	}
	if (data.length > 10) {
		log(`  ${DIM}... and ${data.length - 10} more${RESET}`);
	}
	log();
}

export function renderDebtEstimate(data: DebtEstimate, log: (msg?: string) => void): void {
	if (data.items.length === 0) {
		log(`\n  ${GREEN}✓${RESET} ${data.summary}\n`);
		return;
	}
	log(`\n  ${BOLD}Technical Debt Estimate${RESET}\n`);
	const sevColor = (s: DebtItem["severity"]) =>
		s === "critical" ? RED : s === "high" ? RED : s === "medium" ? YELLOW : DIM;
	for (const item of data.items) {
		const c = sevColor(item.severity);
		log(`  ${c}●${RESET} ${item.category}: ${item.description}  ${DIM}~${item.estimatedHours}h${RESET}`);
	}
	log(`\n  ${BOLD}Total:${RESET} ~${data.totalHours}h  ${DIM}(${data.summary})${RESET}\n`);
}
