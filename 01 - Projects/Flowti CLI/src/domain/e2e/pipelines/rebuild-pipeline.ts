/**
 * rebuild-pipeline.ts — Composes the vault rebuild pipeline.
 *
 * Steps: teardown → vitest (prerequisites + installer) → report → cleanup
 */

import type { PipelineStep, StepOutput } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { proc } from "../../../infrastructure/proc.js";
import { createTeardownStep, createVitestStep, createReportStep, createCleanupStep } from "../steps/index.js";

/** Step that configures env for prerequisites + installer run. */
function createRebuildEnvStep(): PipelineStep {
	return {
		id: "e2e:rebuild-env",
		label: "Configure Rebuild Environment",
		execute(): StepOutput {
			proc.env().E2E_JOURNEY = "prerequisites,installer";
			proc.env().E2E_RUN_PREREQUISITES = "true";
			proc.env().E2E_RUN_INSTALLER = "true";
			return { success: true };
		},
	};
}

/** Step that cleans up rebuild-specific env vars. */
function createRebuildEnvCleanupStep(): PipelineStep {
	return {
		id: "e2e:rebuild-env-cleanup",
		label: "Cleanup Rebuild Environment",
		execute(): StepOutput {
			delete proc.env().E2E_JOURNEY;
			delete proc.env().E2E_RUN_PREREQUISITES;
			delete proc.env().E2E_RUN_INSTALLER;
			return { success: true };
		},
	};
}

export function buildRebuildPipeline(e2e: E2EPaths): PipelineStep[] {
	return [
		createTeardownStep(e2e),
		createRebuildEnvStep(),
		createVitestStep(e2e),
		createReportStep(e2e),
		createCleanupStep(e2e),
		createRebuildEnvCleanupStep(),
	];
}
