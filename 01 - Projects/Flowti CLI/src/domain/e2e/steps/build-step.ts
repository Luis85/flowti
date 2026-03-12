/**
 * build-step.ts — PipelineSteps for build, increment, and publish operations.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { quickBuildAndDeploy, readBuildStats } from "../e2e-build.js";
import { generateIncrementStateReport, generatePublishStateReport } from "../e2e-state-reports.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";

export function createQuickBuildStep(e2e: E2EPaths, deps: Pick<CliDeps, "disk" | "paths" | "shell" | "log">): PipelineStep {
	return {
		id: "e2e:quick-build",
		label: "Quick Build & Deploy",
		execute(): StepOutput {
			const exitCode = quickBuildAndDeploy(e2e, deps);
			return {
				success: exitCode === 0,
				metrics: { exitCode },
				data: { exitCode },
			};
		},
	};
}

export function createIncrementBuildStep(e2e: E2EPaths, deps: Pick<CliDeps, "shell" | "disk" | "paths" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:increment-build",
		label: "Increment Build",
		dependencies: ["e2e:teardown"],
		execute(ctx: PipelineContext): StepOutput {
			ctx.log("  Starting increment build (check \u2192 build \u2192 test \u2192 e2e \u2192 docs \u2192 distribute)...\n");
			const startTime = deps.clock.ms();
			const exitCode = deps.shell.run("npm run build:increment", { cwd: e2e.projectRoot });
			const duration = ((deps.clock.ms() - startTime) / 1000).toFixed(1);
			const stats = readBuildStats(e2e, deps);

			render.incrementSummary(exitCode, duration, stats);
			generateIncrementStateReport(exitCode, duration, stats, e2e, deps);

			ctx.setStepData("e2e:increment-build", { exitCode, duration, stats });

			return {
				success: exitCode === 0,
				metrics: { exitCode, duration: `${duration}s` },
				data: { exitCode, duration, stats },
			};
		},
	};
}

export function createPublishStep(e2e: E2EPaths, deps: Pick<CliDeps, "shell" | "disk" | "paths" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:publish",
		label: "Publish",
		execute(ctx: PipelineContext): StepOutput {
			ctx.log("  Starting publish (check \u2192 build \u2192 test \u2192 docs \u2192 publish)...\n");
			const startTime = deps.clock.ms();
			const exitCode = deps.shell.run("npm run build:release", { cwd: e2e.projectRoot });
			const duration = ((deps.clock.ms() - startTime) / 1000).toFixed(1);
			const stats = readBuildStats(e2e, deps);

			render.publishSummary(exitCode, duration, stats);
			generatePublishStateReport(exitCode, duration, stats, e2e, deps);

			ctx.setStepData("e2e:publish", { exitCode, duration, stats });

			return {
				success: exitCode === 0,
				metrics: { exitCode, duration: `${duration}s` },
				data: { exitCode, duration, stats },
			};
		},
	};
}
