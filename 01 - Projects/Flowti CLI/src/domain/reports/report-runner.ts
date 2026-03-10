/**
 * report-runner.ts — Report generation runner (facade over generic pipeline).
 *
 * Delegates all orchestration to the generic pipeline engine via
 * report-pipeline.ts. Exports backward-compatible types and functions
 * so existing consumers (reports.ts, tests) continue to work.
 */

import type { GeneratorOutput, ReportGenerator } from "../../infrastructure/types.js";
import type { StepResult, PipelineResult } from "../../infrastructure/pipeline/pipeline-types.js";
import { runReportPipeline } from "./report-pipeline.js";

// ── Backward-compatible types ────────────────────────────────────────

/**
 * Result recorded after a single generator completes.
 * Structurally compatible with the pipeline's StepResult.
 */
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

// ── Runner ───────────────────────────────────────────────────────────

export interface RunOptions {
	/** Run generators in dependency-aware phases (independent generators run first). */
	parallel?: boolean;
	/** Optional log function for generator progress messages. */
	log?: (msg: string) => void;
}

/**
 * Run all configured report generators.
 *
 * Delegates to the generic pipeline engine. The pipeline handles
 * prerequisite execution, dependency resolution, output capture,
 * resilient error handling, and summary logging.
 */
export async function runAllReports(
	generators: ReportGenerator[],
	projectPath: string,
	options: RunOptions = {},
): Promise<ReportRunResult> {
	const pipelineResult = await runReportPipeline(generators, projectPath, {
		parallel: options.parallel,
		log: options.log,
	});

	return toReportRunResult(pipelineResult);
}

// ── Result conversion ────────────────────────────────────────────────

function toGeneratorResult(step: StepResult): GeneratorResult {
	return {
		id: step.id,
		label: step.label,
		success: step.success,
		durationMs: step.durationMs,
		output: step.output ? {
			success: step.output.success,
			outputPath: step.output.outputPath ?? "",
			metrics: (step.output.metrics ?? {}) as Record<string, string | number>,
			warnings: step.output.warnings,
		} : null,
		error: step.error,
		warnings: step.warnings,
	};
}

function toReportRunResult(pipeline: PipelineResult): ReportRunResult {
	return {
		generators: pipeline.steps.map(toGeneratorResult),
		totalDurationMs: pipeline.totalDurationMs,
		passed: pipeline.passed,
		failed: pipeline.failed,
	};
}
