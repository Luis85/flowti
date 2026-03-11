/**
 * increment-pipeline.ts — Composes the increment build pipeline.
 *
 * Steps: teardown → increment build
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";
import { createTeardownStep, createIncrementBuildStep } from "../steps/index.js";

export function buildIncrementPipeline(e2e: E2EPaths, deps: Pick<CliDeps, "shell" | "disk" | "paths" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep[] {
	return [
		createTeardownStep(e2e, deps),
		createIncrementBuildStep(e2e, deps, render),
	];
}
