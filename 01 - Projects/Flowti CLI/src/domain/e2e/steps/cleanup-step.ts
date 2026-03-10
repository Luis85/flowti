/**
 * cleanup-step.ts — PipelineStep for post-session cleanup (collapse file explorer).
 */

import type { PipelineStep, StepOutput } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { collapseFileExplorer } from "../e2e-prerequisites.js";

export function createCleanupStep(e2e: E2EPaths): PipelineStep {
	return {
		id: "e2e:cleanup",
		label: "Cleanup",
		execute(): StepOutput {
			collapseFileExplorer(e2e);
			return { success: true };
		},
	};
}
