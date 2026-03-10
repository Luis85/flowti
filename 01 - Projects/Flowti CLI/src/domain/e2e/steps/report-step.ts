/**
 * report-step.ts — PipelineStep for generating and opening the E2E report.
 */

import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { generateReport, openReportInObsidian, restorePluginState } from "../e2e-runner.js";

export function createReportStep(e2e: E2EPaths): PipelineStep {
	return {
		id: "e2e:report",
		label: "E2E Report",
		dependencies: ["e2e:vitest"],
		execute(ctx: PipelineContext): StepOutput {
			ctx.log("\n[e2e] Generating E2E report (this may take a moment)...\n");
			const reportVaultPath = generateReport(e2e);

			if (reportVaultPath) {
				openReportInObsidian(reportVaultPath, e2e);
				restorePluginState(e2e);
				return {
					success: true,
					outputPath: reportVaultPath,
					data: { reportVaultPath },
				};
			}

			return {
				success: true,
				warnings: ["Report generation produced no output path"],
			};
		},
	};
}
