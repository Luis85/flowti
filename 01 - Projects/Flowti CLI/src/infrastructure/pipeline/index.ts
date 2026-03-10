/**
 * pipeline/index.ts — Barrel export for the generic execution pipeline.
 */

export type {
	PipelineStep,
	StepOutput,
	StepResult,
	PipelineResult,
	PipelineOptions,
	PipelineDeps,
	PipelineContext,
	StepPhase,
} from "./pipeline-types.js";

export { PipelineContextImpl, createPipelineContext } from "./pipeline-context.js";
export { resolvePhases, collectStepPrerequisites } from "./pipeline-phases.js";
export { runPipeline, runPipelineWithContext } from "./pipeline-runner.js";
