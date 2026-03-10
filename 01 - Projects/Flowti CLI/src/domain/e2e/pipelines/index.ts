/**
 * pipelines/index.ts — Barrel export for all E2E pipeline compositions.
 */

export { buildSessionPipeline } from "./session-pipeline.js";
export type { SessionPipelineOptions } from "./session-pipeline.js";
export { buildIncrementPipeline } from "./increment-pipeline.js";
export { buildPublishPipeline } from "./publish-pipeline.js";
export { buildRebuildPipeline } from "./rebuild-pipeline.js";
export { buildSuitePipeline } from "./suite-pipeline.js";
