/**
 * prerequisite-step.ts — PipelineStep for E2E vault prerequisite checks.
 */

import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { checkPrerequisites, validatePrerequisites } from "../e2e-prerequisites.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";

export function createPrerequisiteStep(e2e: E2EPaths, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:prerequisites",
		label: "Prerequisites",
		execute(ctx: PipelineContext): StepOutput {
			const results = checkPrerequisites(e2e);
			render.prerequisites(results, e2e);
			validatePrerequisites(results);

			ctx.setStepData("e2e:prerequisites", { results });

			const warnings: string[] = [];
			if (!results.vaultInstalled) warnings.push("Vault not installed — installer will run");
			if (!results.testDataPresent) warnings.push("Test data missing — will be generated during setup");

			return {
				success: true,
				data: { results },
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		},
	};
}
