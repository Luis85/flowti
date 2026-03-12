/**
 * rebuild-pipeline.ts — Composes the vault rebuild pipeline.
 *
 * Steps: teardown → vitest (prerequisites + installer) → report → cleanup
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep, StepOutput } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { createTeardownStep, createVitestStep, createReportStep, createCleanupStep } from "../steps/index.js";

/** Step that configures env for prerequisites + installer run. */
function createRebuildEnvStep(deps: Pick<CliDeps, "proc">): PipelineStep {
	return {
		id: "e2e:rebuild-env",
		label: "Configure Rebuild Environment",
		execute(): StepOutput {
			deps.proc.env().E2E_JOURNEY = "prerequisites,installer";
			deps.proc.env().E2E_RUN_PREREQUISITES = "true";
			deps.proc.env().E2E_RUN_INSTALLER = "true";
			return { success: true };
		},
	};
}

/** Step that cleans up rebuild-specific env vars. */
function createRebuildEnvCleanupStep(deps: Pick<CliDeps, "proc">): PipelineStep {
	return {
		id: "e2e:rebuild-env-cleanup",
		label: "Cleanup Rebuild Environment",
		execute(): StepOutput {
			delete deps.proc.env().E2E_JOURNEY;
			delete deps.proc.env().E2E_RUN_PREREQUISITES;
			delete deps.proc.env().E2E_RUN_INSTALLER;
			return { success: true };
		},
	};
}

export function buildRebuildPipeline(e2e: E2EPaths, deps: Pick<CliDeps, "disk" | "shell" | "paths" | "proc" | "log">): PipelineStep[] {
	return [
		createTeardownStep(e2e, deps),
		createRebuildEnvStep(deps),
		createVitestStep(e2e, deps),
		createReportStep(e2e, deps),
		createCleanupStep(e2e, deps),
		createRebuildEnvCleanupStep(deps),
	];
}
