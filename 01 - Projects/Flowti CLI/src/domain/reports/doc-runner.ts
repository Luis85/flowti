/**
 * doc-runner.ts — Documentation generation runner (facade over generic pipeline).
 *
 * Delegates all orchestration to the generic pipeline engine via
 * doc-pipeline.ts. Mirrors report-runner.ts for the documentation domain.
 *
 * External doc generators (e.g. TypeDoc) and built-in reference generators
 * (CLI Reference, Entity Reference) are both first-class pipeline steps.
 */

import type { GeneratorOutput, DocGenerator } from "../../infrastructure/types.js";
import type { StepResult, PipelineResult } from "../../infrastructure/pipeline/pipeline-types.js";
import { runDocPipeline } from "./doc-pipeline.js";

// ── Result types ─────────────────────────────────────────────────────

/** Result recorded after a single doc generator completes. */
export interface DocGeneratorResult {
	id: string;
	label: string;
	success: boolean;
	durationMs: number;
	output: GeneratorOutput | null;
	error?: string;
	warnings?: string[];
}

export interface DocRunResult {
	generators: DocGeneratorResult[];
	totalDurationMs: number;
	passed: number;
	failed: number;
}

// ── Runner ───────────────────────────────────────────────────────────

/**
 * Run all documentation generators (external + built-in references).
 *
 * Delegates to the generic pipeline engine. The pipeline handles
 * output capture, resilient error handling, and summary logging.
 */
export async function runAllDocs(
	configGenerators: DocGenerator[],
	projectPath: string,
): Promise<DocRunResult> {
	const pipelineResult = await runDocPipeline(configGenerators, projectPath);
	return toDocRunResult(pipelineResult);
}

// ── Result conversion ────────────────────────────────────────────────

function toDocGeneratorResult(step: StepResult): DocGeneratorResult {
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

function toDocRunResult(pipeline: PipelineResult): DocRunResult {
	return {
		generators: pipeline.steps.map(toDocGeneratorResult),
		totalDurationMs: pipeline.totalDurationMs,
		passed: pipeline.passed,
		failed: pipeline.failed,
	};
}
