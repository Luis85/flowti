/**
 * suite-pipeline.ts — Composes the non-interactive E2E suite pipeline.
 *
 * Steps: vitest → report
 * Used by `runE2ESuite()` for CLI-driven (non-interactive) runs.
 */

import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { createVitestStep, createReportStep } from "../steps/index.js";

export function buildSuitePipeline(e2e: E2EPaths): PipelineStep[] {
	return [
		createVitestStep(e2e),
		createReportStep(e2e),
	];
}
