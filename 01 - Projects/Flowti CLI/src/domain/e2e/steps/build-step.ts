/**
 * build-step.ts — PipelineSteps for build, increment, and publish operations.
 */

import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { shell } from "../../../infrastructure/shell.js";
import { quickBuildAndDeploy, readBuildStats } from "../e2e-build.js";
import { generateIncrementStateReport, generatePublishStateReport } from "../e2e-state-reports.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";

export function createQuickBuildStep(e2e: E2EPaths): PipelineStep {
	return {
		id: "e2e:quick-build",
		label: "Quick Build & Deploy",
		execute(): StepOutput {
			const exitCode = quickBuildAndDeploy(e2e);
			return {
				success: exitCode === 0,
				metrics: { exitCode },
				data: { exitCode },
			};
		},
	};
}

export function createIncrementBuildStep(e2e: E2EPaths, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:increment-build",
		label: "Increment Build",
		dependencies: ["e2e:teardown"],
		execute(ctx: PipelineContext): StepOutput {
			ctx.log("  Starting increment build (check → build → test → e2e → docs → distribute)...\n");
			const startTime = Date.now();
			const exitCode = shell.run("npm run build:increment", { cwd: e2e.projectRoot });
			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			const stats = readBuildStats(e2e);

			render.incrementSummary(exitCode, duration, stats);
			generateIncrementStateReport(exitCode, duration, stats, e2e);

			ctx.setStepData("e2e:increment-build", { exitCode, duration, stats });

			return {
				success: exitCode === 0,
				metrics: { exitCode, duration: `${duration}s` },
				data: { exitCode, duration, stats },
			};
		},
	};
}

export function createPublishStep(e2e: E2EPaths, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:publish",
		label: "Publish",
		execute(ctx: PipelineContext): StepOutput {
			ctx.log("  Starting publish (check → build → test → docs → publish)...\n");
			const startTime = Date.now();
			const exitCode = shell.run("npm run build:release", { cwd: e2e.projectRoot });
			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			const stats = readBuildStats(e2e);

			render.publishSummary(exitCode, duration, stats);
			generatePublishStateReport(exitCode, duration, stats, e2e);

			ctx.setStepData("e2e:publish", { exitCode, duration, stats });

			return {
				success: exitCode === 0,
				metrics: { exitCode, duration: `${duration}s` },
				data: { exitCode, duration, stats },
			};
		},
	};
}
