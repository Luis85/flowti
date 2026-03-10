/**
 * prerequisite-step.ts — PipelineStep for E2E vault prerequisite checks.
 */

import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { checkPrerequisites, validatePrerequisites } from "../e2e-prerequisites.js";
import { printPrerequisites } from "../../../ui/e2e/e2e-formatters.js";

export function createPrerequisiteStep(e2e: E2EPaths): PipelineStep {
	return {
		id: "e2e:prerequisites",
		label: "Prerequisites",
		execute(ctx: PipelineContext): StepOutput {
			const results = checkPrerequisites(e2e);
			printPrerequisites(results, e2e);
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
