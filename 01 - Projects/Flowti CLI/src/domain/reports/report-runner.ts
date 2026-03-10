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
import { clearRunContext, pushResult, setCommandOutput } from "./run-context.js";

import { partitionByDependency, collectPrerequisites } from "./report-phases.js";

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

// ── Runner helpers ──────────────────────────────────────────────────

function runPrerequisites(
	prereqs: string[] | undefined,
	projectPath: string,
	completedPrereqs: Set<string>,
): void {
	if (!prereqs) return;
	for (const prereq of prereqs) {
		if (completedPrereqs.has(prereq)) continue;
		log(`    ${DIM}prerequisite: ${prereq}${RESET}`);
		const { output, exitCode } = shell.runCaptureStatus(prereq, { cwd: projectPath });
		completedPrereqs.add(prereq);
		setCommandOutput(prereq, output);
		if (exitCode !== 0) {
			throw new Error(`Prerequisite failed (exit ${exitCode}): ${prereq}`);
		}
	}
}

function executeGenerator(
	gen: ReportGenerator,
	projectPath: string,
): { output: GeneratorOutput | null; success: boolean; error?: string } {
	if (gen.id && hasGenerator(gen.id)) {
		const output = runGenerator(gen.id, projectPath);
		if (!output) return { output: null, success: false, error: "Generator returned null" };
		return {
			output,
			success: output.success,
			error: output.success ? undefined : "Generator reported failure (missing data source)",
		};
	}
	if (gen.command) {
		const { exitCode } = shell.runCaptureStatus(gen.command, { cwd: projectPath });
		return { output: null, success: exitCode === 0, error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined };
	}
	return { output: null, success: false, error: `Unknown generator: "${gen.id ?? gen.label}"` };
}

// ── Runner ──────────────────────────────────────────────────────────

export interface RunOptions {
	/** Run generators in dependency-aware phases (independent generators run first). */
	parallel?: boolean;
}

export function runAllReports(
	generators: ReportGenerator[],
	projectPath: string,
	options: RunOptions = {},
): ReportRunResult {
	const results: GeneratorResult[] = [];
	const runStart = clock.ms();
	clearRunContext();

	if (options.parallel) {
		return runPhased(generators, projectPath, options);
	}

	log(`\n  ${CYAN}▸${RESET} Running ${generators.length} report generator(s)...\n`);

	const completedPrereqs = new Set<string>();

	for (const gen of generators) {
		const result = runSingleGenerator(gen, projectPath, completedPrereqs);
		results.push(result);
		pushResult(result);
	}

	return buildRunResult(results, runStart);
}

// ── Result aggregation ─────────────────────────────────────────────

function buildRunResult(results: GeneratorResult[], runStart: number): ReportRunResult {
	const totalDurationMs = clock.ms() - runStart;
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	printRunSummary(results, totalDurationMs);

	return { generators: results, totalDurationMs, passed, failed };
}

// ── Single generator ───────────────────────────────────────────────

function resolveGenId(gen: ReportGenerator): string {
	return gen.id ?? gen.label.toLowerCase().replace(/\s+/g, "-");
}

function runSingleGenerator(
	gen: ReportGenerator,
	projectPath: string,
	completedPrereqs: Set<string>,
): GeneratorResult {
	const genId = resolveGenId(gen);

	log(`  ${CYAN}▸${RESET} ${gen.label}`);
	const start = clock.ms();

	let result: { output: GeneratorOutput | null; success: boolean; error?: string };

	try {
		runPrerequisites(gen.prerequisites, projectPath, completedPrereqs);
		result = executeGenerator(gen, projectPath);
	} catch (err) {
		result = { output: null, success: false, error: err instanceof Error ? err.message : String(err) };
	}

	const durationMs = clock.ms() - start;
	const dur = (durationMs / 1000).toFixed(1);

	if (result.success) {
		log(`  ${GREEN}✓${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
	} else {
		log(`  ${RED}✗${RESET} ${gen.label} ${DIM}(${dur}s)${RESET}`);
	}

	return { id: genId, label: gen.label, success: result.success, durationMs, output: result.output, error: result.error, warnings: result.output?.warnings };
}

/**
 * Run phase prerequisites upfront; mark dependent generators as failed on error.
 */
function runPhasePrerequisites(
	phaseGenerators: ReportGenerator[],
	projectPath: string,
	completedPrereqs: Set<string>,
	results: GeneratorResult[],
): void {
	const prereqs = collectPrerequisites(phaseGenerators);
	for (const prereq of prereqs) {
		if (completedPrereqs.has(prereq)) continue;
		log(`    ${DIM}prerequisite: ${prereq}${RESET}`);
		const { output, exitCode } = shell.runCaptureStatus(prereq, { cwd: projectPath });
		completedPrereqs.add(prereq);
		setCommandOutput(prereq, output);
		if (exitCode !== 0) {
			for (const gen of phaseGenerators) {
				if (gen.prerequisites?.includes(prereq)) {
					const genId = resolveGenId(gen);
					log(`  ${RED}✗${RESET} ${gen.label} ${DIM}(prerequisite failed)${RESET}`);
					const failResult: GeneratorResult = { id: genId, label: gen.label, success: false, durationMs: 0, output: null, error: `Prerequisite failed (exit ${exitCode}): ${prereq}` };
					results.push(failResult);
					pushResult(failResult);
				}
			}
		}
	}
}

/**
 * Run generators in dependency-aware phases.
 * All prerequisites for a phase are collected and run first,
 * then all generators in that phase execute.
 */
function runPhased(
	generators: ReportGenerator[],
	projectPath: string,
	options: RunOptions,
): ReportRunResult {
	const phases = partitionByDependency(generators);
	const results: GeneratorResult[] = [];
	const runStart = clock.ms();
	const completedPrereqs = new Set<string>();
	clearRunContext();

	const phaseCount = phases.length;
	log(`\n  ${CYAN}▸${RESET} Running ${generators.length} generator(s) in ${phaseCount} phase(s)...\n`);

	for (const phase of phases) {
		if (phaseCount > 1) {
			log(`  ${DIM}── Phase ${phase.phase} (${phase.generators.length} generator${phase.generators.length > 1 ? "s" : ""}) ──${RESET}`);
		}

		runPhasePrerequisites(phase.generators, projectPath, completedPrereqs, results);

		// Run generators (skipping those already failed due to prereq)
		const failedIds = new Set(results.filter((r) => !r.success).map((r) => r.id));
		for (const gen of phase.generators) {
			if (failedIds.has(resolveGenId(gen))) continue;
			const result = runSingleGenerator(gen, projectPath, completedPrereqs);
			results.push(result);
			pushResult(result);
		}
	}

	return buildRunResult(results, runStart);
}

// ── Summary helpers ─────────────────────────────────────────────────

function formatResultIcon(r: GeneratorResult): string {
	const hasWarnings = r.warnings && r.warnings.length > 0;
	if (!r.success) return `${RED}✗${RESET}`;
	return hasWarnings ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
}

function printResultWarnings(warnings: string[]): void {
	for (const w of warnings) {
		if (w.startsWith("  ")) {
			log(`        ${DIM}${w.trim()}${RESET}`);
		} else {
			log(`      ${YELLOW}⚠${RESET} ${w}`);
		}
	}
}

function buildSummaryLine(results: GeneratorResult[], totalSec: string): string {
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;
	const warned = results.filter((r) => r.warnings && r.warnings.length > 0).length;
	const parts: string[] = [];
	parts.push(`${GREEN}${passed} passed${RESET}`);
	if (warned > 0) parts.push(`${YELLOW}${warned} with warnings${RESET}`);
	if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
	parts.push(`${DIM}(${totalSec}s)${RESET}`);
	return `  ${parts.join(", ")}`;
}

// ── Summary ─────────────────────────────────────────────────────────

function printRunSummary(results: GeneratorResult[], totalMs: number): void {
	const totalSec = (totalMs / 1000).toFixed(1);

	log(`\n  ${BOLD}Report Run Summary${RESET}\n`);

	for (const r of results) {
		const icon = formatResultIcon(r);
		const dur = (r.durationMs / 1000).toFixed(1);
		const suffix = r.error ? ` — ${RED}${r.error}${RESET}` : "";
		log(`    ${icon} ${r.label} ${DIM}(${dur}s)${RESET}${suffix}`);
		if (r.warnings && r.warnings.length > 0) {
			printResultWarnings(r.warnings);
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

	log();
	log(buildSummaryLine(results, totalSec));
	log();
}
