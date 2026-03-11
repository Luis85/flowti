/**
 * teardown-step.ts — PipelineStep for tearing down the E2E test vault.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep, StepOutput } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { performTeardown } from "../e2e-teardown.js";

export function createTeardownStep(e2e: E2EPaths, deps: Pick<CliDeps, "disk" | "paths" | "shell" | "log">): PipelineStep {
	return {
		id: "e2e:teardown",
		label: "Teardown Vault",
		async execute(): Promise<StepOutput> {
			await performTeardown(e2e, deps);
			return { success: true };
		},
	};
}
