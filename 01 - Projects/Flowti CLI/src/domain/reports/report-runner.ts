/**
 * report-runner.ts — Resilient report generation runner.
 *
 * Runs all configured generators, never stops on failure.
 * Captures output per generator, extracts warnings and errors,
 * and always produces a categorized summary at the end.
 * Failed reports are signals, not blockers.
 */

import { shell } from "../../infrastructure/shell.js";
import { RESET, DIM, GREEN, RED, CYAN, BOLD, YELLOW } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { clock } from "../../infrastructure/clock.js";
import type { ReportGenerator } from "../../infrastructure/types.js";

// ── Types ───────────────────────────────────────────────────────────

export interface OutputIssue {
	level: "error" | "warning";
	message: string;
}

export interface GeneratorResult {
	label: string;
	command: string;
	exitCode: number;
	durationMs: number;
	output: string;
	issues: OutputIssue[];
}

export interface ReportRunResult {
	generators: GeneratorResult[];
	totalDurationMs: number;
	passed: number;
	failed: number;
}

// ── Output parsing ──────────────────────────────────────────────────

const ERROR_PATTERNS = [
	/\berror\b/i,
	/\bfailed\b/i,
	/\bfatal\b/i,
	/\bERR!\b/,
	/\bERROR\b/,
	/\bException\b/,
	/\bthrow\b/i,
	/\bnot found\b/i,
	/Cannot find/i,
];

const WARNING_PATTERNS = [
	/\bwarn(ing)?\b/i,
	/\bWARN\b/,
	/\bdeprecated\b/i,
	/\bskipped?\b/i,
];

const NOISE_PATTERNS = [
	/^\s*$/,
	/^\s*at\s+/,
	/node_modules/,
	/^\s*\^/,
];

function parseIssues(output: string): OutputIssue[] {
	const issues: OutputIssue[] = [];
	const seen = new Set<string>();

	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || NOISE_PATTERNS.some((p) => p.test(trimmed))) continue;
		if (seen.has(trimmed)) continue;

		const isError = ERROR_PATTERNS.some((p) => p.test(trimmed));
		const isWarning = !isError && WARNING_PATTERNS.some((p) => p.test(trimmed));

		if (isError || isWarning) {
			seen.add(trimmed);
			issues.push({ level: isError ? "error" : "warning", message: trimmed });
		}
	}

	return issues;
}

// ── Runner ──────────────────────────────────────────────────────────

export function runAllReports(
	generators: ReportGenerator[],
	projectPath: string,
): ReportRunResult {
	const results: GeneratorResult[] = [];
	const runStart = clock.ms();

	log(`\n  ${CYAN}▸${RESET} Running ${generators.length} report generator(s)...\n`);

	for (const gen of generators) {
		log(`  ${CYAN}▸${RESET} ${gen.label}`);
		const start = clock.ms();
		const { output, exitCode } = shell.runCaptureStatus(gen.command, { cwd: projectPath });
		const durationMs = clock.ms() - start;
		const dur = (durationMs / 1000).toFixed(1);
		const issues = parseIssues(output);

		if (exitCode === 0) {
			log(`  ${GREEN}✓${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
		} else {
			log(`  ${RED}✗${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
		}

		results.push({ label: gen.label, command: gen.command, exitCode, durationMs, output, issues });
	}

	const totalDurationMs = clock.ms() - runStart;
	const passed = results.filter((r) => r.exitCode === 0).length;
	const failed = results.filter((r) => r.exitCode !== 0).length;

	printRunSummary(results, totalDurationMs);

	return { generators: results, totalDurationMs, passed, failed };
}

// ── Summary ─────────────────────────────────────────────────────────

function printRunSummary(results: GeneratorResult[], totalMs: number): void {
	const totalSec = (totalMs / 1000).toFixed(1);
	const passed = results.filter((r) => r.exitCode === 0).length;
	const failed = results.filter((r) => r.exitCode !== 0).length;

	log(`\n  ${BOLD}Report Run Summary${RESET}\n`);

	for (const r of results) {
		const icon = r.exitCode === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const dur = (r.durationMs / 1000).toFixed(1);
		const errorCount = r.issues.filter((i) => i.level === "error").length;
		const warnCount = r.issues.filter((i) => i.level === "warning").length;

		let suffix = "";
		if (errorCount > 0 || warnCount > 0) {
			const parts: string[] = [];
			if (errorCount > 0) parts.push(`${RED}${errorCount} error(s)${RESET}`);
			if (warnCount > 0) parts.push(`${YELLOW}${warnCount} warning(s)${RESET}`);
			suffix = ` — ${parts.join(", ")}`;
		}

		log(`    ${icon} ${r.label} ${DIM}(${dur}s)${RESET}${suffix}`);
	}

	// Detailed issues by generator
	const generatorsWithIssues = results.filter((r) => r.issues.length > 0);
	if (generatorsWithIssues.length > 0) {
		log(`\n  ${BOLD}Issues by Generator${RESET}\n`);
		for (const r of generatorsWithIssues) {
			log(`    ${BOLD}${r.label}${RESET}`);
			for (const issue of r.issues) {
				const icon = issue.level === "error" ? `${RED}E${RESET}` : `${YELLOW}W${RESET}`;
				log(`      ${icon} ${issue.message}`);
			}
			log();
		}
	}

	// Totals
	log();
	const totalErrors = results.reduce((s, r) => s + r.issues.filter((i) => i.level === "error").length, 0);
	const totalWarnings = results.reduce((s, r) => s + r.issues.filter((i) => i.level === "warning").length, 0);

	const parts: string[] = [];
	parts.push(`${GREEN}${passed} passed${RESET}`);
	if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
	if (totalErrors > 0) parts.push(`${RED}${totalErrors} error(s)${RESET}`);
	if (totalWarnings > 0) parts.push(`${YELLOW}${totalWarnings} warning(s)${RESET}`);
	parts.push(`${DIM}(${totalSec}s)${RESET}`);

	log(`  ${parts.join(", ")}`);
	log();
}
