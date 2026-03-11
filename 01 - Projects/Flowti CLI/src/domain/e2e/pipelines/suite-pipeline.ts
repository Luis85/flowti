/**
 * suite-pipeline.ts — Composes the non-interactive E2E suite pipeline.
 *
 * Steps: vitest → report
 * Used by `runE2ESuite()` for CLI-driven (non-interactive) runs.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { createVitestStep, createReportStep } from "../steps/index.js";

export function buildSuitePipeline(e2e: E2EPaths, deps: Pick<CliDeps, "disk" | "shell" | "paths" | "log">): PipelineStep[] {
	return [
		createVitestStep(e2e, deps),
		createReportStep(e2e, deps),
	];
}
