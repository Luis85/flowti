/**
 * vitest-step.ts — PipelineStep for running the E2E vitest suite.
 */

import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { runVitest } from "../e2e-runner.js";

export function createVitestStep(e2e: E2EPaths): PipelineStep {
	return {
		id: "e2e:vitest",
		label: "Vitest E2E Suite",
		execute(ctx: PipelineContext): StepOutput {
			const exitCode = runVitest(e2e);
			ctx.setStepData("e2e:vitest", { exitCode });

			return {
				success: exitCode === 0,
				metrics: { exitCode },
				data: { exitCode },
			};
		},
	};
}
