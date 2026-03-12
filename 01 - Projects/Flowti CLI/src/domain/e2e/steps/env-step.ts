/**
 * env-step.ts — PipelineSteps for configuring and cleaning E2E environment variables.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep, StepOutput } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { SessionConfig } from "../e2e-types.js";
import { configureSessionEnv, cleanSessionEnv } from "../e2e-session.js";

export function createEnvConfigStep(config: SessionConfig, deps: Pick<CliDeps, "proc">): PipelineStep {
	return {
		id: "e2e:env-config",
		label: "Configure Environment",
		execute(): StepOutput {
			configureSessionEnv(config, deps);
			return { success: true };
		},
	};
}

export function createEnvCleanupStep(deps: Pick<CliDeps, "proc">): PipelineStep {
	return {
		id: "e2e:env-cleanup",
		label: "Cleanup Environment",
		execute(): StepOutput {
			cleanSessionEnv(deps);
			return { success: true };
		},
	};
}
