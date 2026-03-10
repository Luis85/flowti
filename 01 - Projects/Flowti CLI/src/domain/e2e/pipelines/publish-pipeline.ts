/**
 * publish-pipeline.ts — Composes the publish pipeline.
 *
 * Steps: publish (single step — npm run build:release + report)
 */

import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import { createPublishStep } from "../steps/index.js";

export function buildPublishPipeline(e2e: E2EPaths): PipelineStep[] {
	return [
		createPublishStep(e2e),
	];
}
