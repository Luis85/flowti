/**
 * publish-pipeline.ts — Composes the publish pipeline.
 *
 * Steps: publish (single step — npm run build:release + report)
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";
import { createPublishStep } from "../steps/index.js";

export function buildPublishPipeline(e2e: E2EPaths, deps: Pick<CliDeps, "shell" | "disk" | "paths" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep[] {
	return [
		createPublishStep(e2e, deps, render),
	];
}
