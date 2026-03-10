/**
 * pipeline-runner.ts — Generic execution pipeline engine.
 *
 * Orchestrates PipelineStep execution with:
 *   - Dependency-aware phased scheduling (or linear order)
 *   - Prerequisite command execution with output capture
 *   - Resilient per-step error handling (never crashes the run)
 *   - Structured result collection and summary logging
 *   - Injectable dependencies for full testability
 *   - Async step support (steps may return Promise<StepOutput>)
 *
 * The runner is domain-agnostic. Report generation, test execution,
 * journey execution, and process execution all use this engine.
 */

import type {
	PipelineStep,
	StepResult,
	StepOutput,
	PipelineResult,
	PipelineOptions,
	PipelineDeps,
	PipelineContext,
} from "./pipeline-types.js";
import { createPipelineContext } from "./pipeline-context.js";
import { resolvePhases, collectStepPrerequisites } from "./pipeline-phases.js";

// ── Default dependencies (production) ────────────────────────────────

import { shell } from "../shell.js";
import { clock } from "../clock.js";
import { log as infraLog } from "../logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN, BOLD } from "../ui.js";

const DEFAULT_DEPS: PipelineDeps = {
	runCommand: (cmd, cwd) => shell.runCaptureStatus(cmd, { cwd }),
	now: () => clock.ms(),
	log: infraLog,
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Run a pipeline of steps. Returns a structured result — never throws.
 *
 * @param steps    Ordered list of steps to execute.
 * @param projectPath  Root path for this run (passed to steps via context).
 * @param options  Execution mode and labeling.
 * @param deps     Injectable dependencies (defaults to production shell/clock/log).
 * @returns        Aggregate pipeline result with per-step details.
 */
export async function runPipeline(
	steps: PipelineStep[],
	projectPath: string,
	options: PipelineOptions = {},
	deps: PipelineDeps = DEFAULT_DEPS,
): Promise<PipelineResult> {
	const ctx = createPipelineContext(projectPath);
	const runStart = deps.now();
	const runLabel = options.label ?? "Pipeline Run";

	if (options.phased) {
		return runPhased(steps, ctx, runLabel, deps, runStart);
	}
	return runLinear(steps, ctx, runLabel, deps, runStart);
}

/**
 * Run a pipeline with a pre-existing context (for domain adapters
 * that need to pass the context to steps).
 */
export async function runPipelineWithContext(
	steps: PipelineStep[],
	ctx: PipelineContext,
	options: PipelineOptions = {},
	deps: PipelineDeps = DEFAULT_DEPS,
): Promise<PipelineResult> {
	const runStart = deps.now();
	const runLabel = options.label ?? "Pipeline Run";

	if (options.phased) {
		return runPhased(steps, ctx, runLabel, deps, runStart);
	}
	return runLinear(steps, ctx, runLabel, deps, runStart);
}

// ── Linear execution ─────────────────────────────────────────────────

async function runLinear(
	steps: PipelineStep[],
	ctx: PipelineContext,
	runLabel: string,
	deps: PipelineDeps,
	runStart: number,
): Promise<PipelineResult> {
	deps.log(`\n  ${CYAN}▸${RESET} ${runLabel}: ${steps.length} step(s)...\n`);

	const completedPrereqs = new Set<string>();

	for (const step of steps) {
		const result = await executeStep(step, ctx, completedPrereqs, deps);
		ctx.pushResult(result);
	}

	return buildResult(ctx.getResults(), runStart, deps, runLabel);
}

// ── Phased execution ─────────────────────────────────────────────────

async function runPhased(
	steps: PipelineStep[],
	ctx: PipelineContext,
	runLabel: string,
	deps: PipelineDeps,
	runStart: number,
): Promise<PipelineResult> {
	const phases = resolvePhases(steps);
	const completedPrereqs = new Set<string>();

	deps.log(`\n  ${CYAN}▸${RESET} ${runLabel}: ${steps.length} step(s) in ${phases.length} phase(s)...\n`);

	for (const phase of phases) {
		if (phases.length > 1) {
			deps.log(`  ${DIM}── Phase ${phase.phase} (${phase.steps.length} step${phase.steps.length > 1 ? "s" : ""}) ──${RESET}`);
		}

		// Run all phase prerequisites upfront
		runPhasePrerequisites(phase.steps, ctx, completedPrereqs, deps);

		// Execute steps (skip those already failed due to prereqs)
		const failedIds = new Set(
			[...ctx.getResults()].filter((r) => !r.success).map((r) => r.id),
		);

		for (const step of phase.steps) {
			if (failedIds.has(step.id)) continue;
			const result = await executeStep(step, ctx, completedPrereqs, deps, phase.phase);
			ctx.pushResult(result);
		}
	}

	return buildResult(ctx.getResults(), runStart, deps, runLabel);
}

// ── Step execution ───────────────────────────────────────────────────

async function executeStep(
	step: PipelineStep,
	ctx: PipelineContext,
	completedPrereqs: Set<string>,
	deps: PipelineDeps,
	phase?: number,
): Promise<StepResult> {
	deps.log(`  ${CYAN}▸${RESET} ${step.label}`);
	const start = deps.now();

	let output: StepOutput | null = null;
	let success = false;
	let error: string | undefined;

	try {
		// Run prerequisites
		runStepPrerequisites(step, ctx, completedPrereqs, deps);

		// Check that all step dependencies succeeded
		const depFailure = checkDependencies(step, ctx);
		if (depFailure) {
			throw new Error(depFailure);
		}

		// Execute the step (may be sync or async)
		output = await step.execute(ctx);
		success = output.success;

		// Store step data if provided
		if (output.data) {
			ctx.setStepData(step.id, output.data);
		}

		if (!success) {
			error = "Step reported failure";
		}
	} catch (err) {
		success = false;
		error = err instanceof Error ? err.message : String(err);
	}

	const durationMs = deps.now() - start;
	const dur = (durationMs / 1000).toFixed(1);

	if (success) {
		deps.log(`  ${GREEN}✓${RESET} ${step.label} ${DIM}(${dur}s)${RESET}`);
	} else {
		deps.log(`  ${RED}✗${RESET} ${step.label} ${DIM}(${dur}s)${RESET}`);
	}

	return {
		id: step.id,
		label: step.label,
		success,
		durationMs,
		output,
		error,
		warnings: output?.warnings,
		phase,
	};
}

// ── Prerequisite execution ───────────────────────────────────────────

function runStepPrerequisites(
	step: PipelineStep,
	ctx: PipelineContext,
	completedPrereqs: Set<string>,
	deps: PipelineDeps,
): void {
	if (!step.prerequisites) return;
	for (const prereq of step.prerequisites) {
		if (completedPrereqs.has(prereq)) continue;
		deps.log(`    ${DIM}prerequisite: ${prereq}${RESET}`);
		const { output, exitCode } = deps.runCommand(prereq, ctx.projectPath);
		completedPrereqs.add(prereq);
		ctx.setCommandOutput(prereq, output);
		if (exitCode !== 0) {
			throw new Error(`Prerequisite failed (exit ${exitCode}): ${prereq}`);
		}
	}
}

function runPhasePrerequisites(
	phaseSteps: PipelineStep[],
	ctx: PipelineContext,
	completedPrereqs: Set<string>,
	deps: PipelineDeps,
): void {
	const prereqs = collectStepPrerequisites(phaseSteps);
	for (const prereq of prereqs) {
		if (completedPrereqs.has(prereq)) continue;
		deps.log(`    ${DIM}prerequisite: ${prereq}${RESET}`);
		const { output, exitCode } = deps.runCommand(prereq, ctx.projectPath);
		completedPrereqs.add(prereq);
		ctx.setCommandOutput(prereq, output);
		if (exitCode !== 0) {
			// Mark all steps that depend on this prereq as failed
			for (const step of phaseSteps) {
				if (step.prerequisites?.includes(prereq)) {
					deps.log(`  ${RED}✗${RESET} ${step.label} ${DIM}(prerequisite failed)${RESET}`);
					ctx.pushResult({
						id: step.id,
						label: step.label,
						success: false,
						durationMs: 0,
						output: null,
						error: `Prerequisite failed (exit ${exitCode}): ${prereq}`,
					});
				}
			}
		}
	}
}

// ── Dependency check ─────────────────────────────────────────────────

function checkDependencies(step: PipelineStep, ctx: PipelineContext): string | null {
	if (!step.dependencies || step.dependencies.length === 0) return null;

	const failedDeps: string[] = [];
	for (const depId of step.dependencies) {
		const depResult = ctx.getStepResult(depId);
		if (depResult && !depResult.success) {
			failedDeps.push(depId);
		}
	}

	if (failedDeps.length > 0) {
		return `Dependency failed: ${failedDeps.join(", ")}`;
	}
	return null;
}

// ── Result aggregation ───────────────────────────────────────────────

function buildResult(
	results: readonly StepResult[],
	runStart: number,
	deps: PipelineDeps,
	runLabel: string,
): PipelineResult {
	const totalDurationMs = deps.now() - runStart;
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	printSummary(results, totalDurationMs, deps, runLabel);

	return { steps: [...results], totalDurationMs, passed, failed, skipped: 0 };
}

// ── Summary logging ──────────────────────────────────────────────────

function formatIcon(r: StepResult): string {
	const hasWarnings = r.warnings && r.warnings.length > 0;
	if (!r.success) return `${RED}✗${RESET}`;
	return hasWarnings ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
}

function printStepLine(r: StepResult, deps: PipelineDeps): void {
	const icon = formatIcon(r);
	const dur = (r.durationMs / 1000).toFixed(1);
	const suffix = r.error ? ` — ${RED}${r.error}${RESET}` : "";
	deps.log(`    ${icon} ${r.label} ${DIM}(${dur}s)${RESET}${suffix}`);
	for (const w of r.warnings ?? []) {
		const line = w.startsWith("  ")
			? `        ${DIM}${w.trim()}${RESET}`
			: `      ${YELLOW}⚠${RESET} ${w}`;
		deps.log(line);
	}
}

function printIssues(results: readonly StepResult[], deps: PipelineDeps): void {
	const failedResults = results.filter((r) => r.error);
	if (failedResults.length === 0) return;
	deps.log(`\n  ${BOLD}Issues${RESET}\n`);
	for (const r of failedResults) {
		deps.log(`    ${RED}✗${RESET} ${BOLD}${r.label}${RESET}: ${r.error}`);
	}
}

function printTotals(results: readonly StepResult[], totalSec: string, deps: PipelineDeps): void {
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;
	const warned = results.filter((r) => r.warnings && r.warnings.length > 0).length;

	const parts: string[] = [`${GREEN}${passed} passed${RESET}`];
	if (warned > 0) parts.push(`${YELLOW}${warned} with warnings${RESET}`);
	if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
	parts.push(`${DIM}(${totalSec}s)${RESET}`);

	deps.log("");
	deps.log(`  ${parts.join(", ")}`);
	deps.log("");
}

function printSummary(
	results: readonly StepResult[],
	totalMs: number,
	deps: PipelineDeps,
	runLabel: string,
): void {
	deps.log(`\n  ${BOLD}${runLabel} Summary${RESET}\n`);
	for (const r of results) printStepLine(r, deps);
	printIssues(results, deps);
	printTotals(results, (totalMs / 1000).toFixed(1), deps);
}
