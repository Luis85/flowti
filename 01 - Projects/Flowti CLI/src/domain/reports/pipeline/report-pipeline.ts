/**
 * report-pipeline.ts — Report domain adapter for the generic pipeline.
 *
 * Wraps existing ReportGenerator config entries and GeneratorFn functions
 * as PipelineStep objects, then delegates to the generic pipeline runner.
 *
 * This module bridges the report domain to the pipeline infrastructure
 * without changing existing generator implementations.
 */

import { runPipelineWithContext } from "../../../infrastructure/pipeline/pipeline-runner.js";
import { createPipelineContext } from "../../../infrastructure/pipeline/pipeline-context.js";
import type {
	PipelineStep,
	PipelineResult,
	PipelineContext,
	StepOutput,
} from "../../../infrastructure/pipeline/pipeline-types.js";
import type { ReportGenerator } from "../../../infrastructure/types.js";
import type { CliDeps } from "../../../infrastructure/deps.js";
import { runGenerator, hasGenerator } from "../generator-registry.js";

// ── Dependency resolution ─────────────────────────────────────────────

function resolveDependencies(gen: ReportGenerator): string[] | undefined {
	if (gen.dependencies && gen.dependencies.length > 0) return gen.dependencies;
	return undefined;
}

// ── Step adapter ─────────────────────────────────────────────────────

function resolveGenId(gen: ReportGenerator): string {
	return gen.id ?? gen.label.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Wrap a ReportGenerator config entry as a PipelineStep.
 *
 * The step's execute function delegates to the generator registry
 * for internal generators, or runs the external command for
 * command-based generators.
 */
export function toReportStep(gen: ReportGenerator, deps: Pick<CliDeps, "shell">): PipelineStep {
	const id = resolveGenId(gen);
	return {
		id,
		label: gen.label,
		dependencies: resolveDependencies(gen),
		prerequisites: gen.prerequisites,
		execute: (ctx: PipelineContext): StepOutput => {
			// Internal generator takes priority
			if (gen.id && hasGenerator(gen.id)) {
				const output = runGenerator(gen.id, ctx.projectPath, ctx.deps, ctx);
				if (!output) return { success: false, warnings: [`Generator "${gen.id}" returned no output`] };
				return {
					success: output.success,
					outputPath: output.outputPath,
					metrics: output.metrics,
					warnings: output.warnings,
				};
			}
			// External command fallback
			if (gen.command) {
				const { exitCode } = deps.shell.runCaptureStatus(gen.command, { cwd: ctx.projectPath });
				return { success: exitCode === 0 };
			}
			// No internal generator and no external command
			throw new Error(`Unknown generator: "${id}" — not registered and no command configured`);
		},
	};
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Run all report generators through the generic pipeline.
 *
 * @returns PipelineResult with per-generator results and timing.
 */
export async function runReportPipeline(
	generators: ReportGenerator[],
	projectPath: string,
	deps: CliDeps,
	options?: { parallel?: boolean; log?: (msg: string) => void },
): Promise<PipelineResult> {
	const steps = generators.map((gen) => toReportStep(gen, deps));
	const ctx = createPipelineContext(projectPath, deps, options?.log);

	return runPipelineWithContext(steps, ctx, {
		phased: options?.parallel,
		label: "Report Run",
	});
}

/**
 * Get the PipelineContext from the last report pipeline run.
 * Used by the summary generator to access accumulated results.
 */
export { createPipelineContext };
