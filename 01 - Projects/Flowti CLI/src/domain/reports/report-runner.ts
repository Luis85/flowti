/**
 * report-runner.ts — Resilient report generation runner.
 *
 * Runs all configured generators by calling internal functions directly.
 * Never stops on failure — a broken report is a signal, not a blocker.
 * Always produces a categorized summary at the end.
 */

import { shell } from "../../infrastructure/shell.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN, BOLD } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { clock } from "../../infrastructure/clock.js";
import type { ReportGenerator, GeneratorOutput } from "../../infrastructure/types.js";
import { runGenerator, hasGenerator } from "./generator-registry.js";

// ── Types ───────────────────────────────────────────────────────────

export interface GeneratorResult {
	id: string;
	label: string;
	success: boolean;
	durationMs: number;
	output: GeneratorOutput | null;
	error?: string;
	warnings?: string[];
}

export interface ReportRunResult {
	generators: GeneratorResult[];
	totalDurationMs: number;
	passed: number;
	failed: number;
}

// ── Runner ──────────────────────────────────────────────────────────

export function runAllReports(
	generators: ReportGenerator[],
	projectPath: string,
): ReportRunResult {
	const results: GeneratorResult[] = [];
	const runStart = clock.ms();

	log(`\n  ${CYAN}▸${RESET} Running ${generators.length} report generator(s)...\n`);

	// Deduplicate prerequisites across all generators to avoid running the same command twice.
	const completedPrereqs = new Set<string>();

	for (const gen of generators) {
		const genId = gen.id ?? gen.label.toLowerCase().replace(/\s+/g, "-");
		log(`  ${CYAN}▸${RESET} ${gen.label}`);
		const start = clock.ms();

		let output: GeneratorOutput | null = null;
		let error: string | undefined;
		let success = false;

		try {
			// Run prerequisites (skipping any already completed in this run)
			if (gen.prerequisites) {
				for (const prereq of gen.prerequisites) {
					if (completedPrereqs.has(prereq)) continue;
					log(`    ${DIM}prerequisite: ${prereq}${RESET}`);
					const { exitCode } = shell.runCaptureStatus(prereq, { cwd: projectPath });
					completedPrereqs.add(prereq);
					if (exitCode !== 0) {
						throw new Error(`Prerequisite failed (exit ${exitCode}): ${prereq}`);
					}
				}
			}

			// Internal generator (by ID) takes priority
			if (gen.id && hasGenerator(gen.id)) {
				output = runGenerator(gen.id, projectPath);
				if (output) {
					success = output.success;
					if (!success) error = "Generator reported failure (missing data source)";
				}
			} else if (gen.command) {
				// Fallback: external command (for projects with custom scripts)
				const { exitCode } = shell.runCaptureStatus(gen.command, { cwd: projectPath });
				success = exitCode === 0;
				if (!success) error = `Command exited with code ${exitCode}`;
			} else {
				error = `Unknown generator: "${gen.id ?? gen.label}"`;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}

		const durationMs = clock.ms() - start;
		const dur = (durationMs / 1000).toFixed(1);

		if (success) {
			log(`  ${GREEN}✓${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
		} else {
			log(`  ${RED}✗${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
		}

		const warnings = output?.warnings;
		results.push({ id: genId, label: gen.label, success, durationMs, output, error, warnings });
	}

	const totalDurationMs = clock.ms() - runStart;
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	printRunSummary(results, totalDurationMs);

	return { generators: results, totalDurationMs, passed, failed };
}

// ── Summary ─────────────────────────────────────────────────────────

function printRunSummary(results: GeneratorResult[], totalMs: number): void {
	const totalSec = (totalMs / 1000).toFixed(1);
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	log(`\n  ${BOLD}Report Run Summary${RESET}\n`);

	for (const r of results) {
		const hasWarnings = r.warnings && r.warnings.length > 0;
		const icon = !r.success ? `${RED}✗${RESET}` : hasWarnings ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
		const dur = (r.durationMs / 1000).toFixed(1);
		const suffix = r.error ? ` — ${RED}${r.error}${RESET}` : "";
		log(`    ${icon} ${r.label} ${DIM}(${dur}s)${RESET}${suffix}`);
		if (hasWarnings) {
			for (const w of r.warnings!) {
				if (w.startsWith("  ")) {
					log(`        ${DIM}${w.trim()}${RESET}`);
				} else {
					log(`      ${YELLOW}⚠${RESET} ${w}`);
				}
			}
		}
	}

	// Detailed errors
	const failedResults = results.filter((r) => r.error);
	if (failedResults.length > 0) {
		log(`\n  ${BOLD}Issues${RESET}\n`);
		for (const r of failedResults) {
			log(`    ${RED}✗${RESET} ${BOLD}${r.label}${RESET}: ${r.error}`);
		}
	}

	// Totals
	log();
	const warned = results.filter((r) => r.warnings && r.warnings.length > 0).length;
	const parts: string[] = [];
	parts.push(`${GREEN}${passed} passed${RESET}`);
	if (warned > 0) parts.push(`${YELLOW}${warned} with warnings${RESET}`);
	if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
	parts.push(`${DIM}(${totalSec}s)${RESET}`);

	log(`  ${parts.join(", ")}`);
	log();
}
