/**
 * doc-pipeline.ts — Documentation domain adapter for the generic pipeline.
 *
 * Wraps both config-defined doc generators (external commands) and
 * built-in reference generators as PipelineStep objects, then delegates
 * to the generic pipeline runner.
 *
 * This mirrors report-pipeline.ts but for the documentation domain.
 * References (CLI Reference, Entity Reference) become first-class
 * pipeline steps alongside external generators like TypeDoc.
 */

import { runPipelineWithContext } from "../../../infrastructure/pipeline/pipeline-runner.js";
import { createPipelineContext } from "../../../infrastructure/pipeline/pipeline-context.js";
import type {
	PipelineStep,
	PipelineResult,
	PipelineContext,
	StepOutput,
} from "../../../infrastructure/pipeline/pipeline-types.js";
import type { DocGenerator, ReferenceConfig } from "../../../infrastructure/types.js";
import type { CliDeps } from "../../../infrastructure/deps.js";
import { runReference } from "../generator-registry.js";

// ── Step adapters ────────────────────────────────────────────────────

/**
 * Wrap an external DocGenerator config entry as a PipelineStep.
 * External generators run a shell command (e.g. TypeDoc).
 */
export function toDocStep(gen: DocGenerator, deps: Pick<CliDeps, "shell">): PipelineStep {
	const id = gen.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	return {
		id,
		label: gen.label,
		execute: (ctx: PipelineContext): StepOutput => {
			const { exitCode } = deps.shell.runCaptureStatus(gen.command, { cwd: ctx.projectPath });
			return { success: exitCode === 0 };
		},
	};
}

/**
 * Wrap a built-in reference generator as a PipelineStep.
 * If a ReferenceConfig provides a `source`, it is injected into step data
 * so the generator can resolve paths relative to the project root.
 */
export function toReferenceStep(ref: ReferenceConfig): PipelineStep {
	return {
		id: ref.id,
		label: ref.label,
		stepConfig: ref.source ? { source: ref.source } : undefined,
		execute: (ctx: PipelineContext): StepOutput => {
			// Inject source into step data so generators can read it
			if (ref.source) ctx.setStepData(ref.id, { source: ref.source });

			const output = runReference(ref.id, ctx.projectPath, ctx.deps, ctx);
			if (!output) return { success: false, warnings: [`Reference "${ref.id}" returned no output`] };
			return {
				success: output.success,
				outputPath: output.outputPath,
				metrics: output.metrics,
				warnings: output.warnings,
			};
		},
	};
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build the full list of doc pipeline steps from config and registry.
 *
 * Order: external generators first (e.g. TypeDoc), then configured references.
 * Only references declared in `references` are included — no implicit defaults.
 */
export function buildDocSteps(
	configGenerators: DocGenerator[],
	references: ReferenceConfig[],
	deps: Pick<CliDeps, "shell">,
): PipelineStep[] {
	const externalSteps = configGenerators.map((gen) => toDocStep(gen, deps));
	const referenceSteps = references.map(toReferenceStep);
	return [...externalSteps, ...referenceSteps];
}

/**
 * Run all documentation generators through the generic pipeline.
 *
 * @returns PipelineResult with per-generator results and timing.
 */
export async function runDocPipeline(
	configGenerators: DocGenerator[],
	references: ReferenceConfig[],
	projectPath: string,
	deps: CliDeps,
): Promise<PipelineResult> {
	const steps = buildDocSteps(configGenerators, references, deps);
	const ctx = createPipelineContext(projectPath, deps);

	return runPipelineWithContext(steps, ctx, {
		label: "Documentation",
	});
}

export { createPipelineContext };
