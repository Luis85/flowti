/**
 * session-pipeline.ts — Composes the E2E test session pipeline.
 *
 * Steps: env config → vitest → report → session note → cleanup → env cleanup
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import type { SessionConfig, JourneyEntry, PrerequisiteResults } from "../e2e-types.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";
import {
	createEnvConfigStep,
	createVitestStep,
	createReportStep,
	createSessionNoteStep,
	createCleanupStep,
	createEnvCleanupStep,
} from "../steps/index.js";

export interface SessionPipelineOptions {
	config: SessionConfig;
	entries: JourneyEntry[];
	prereqResults: PrerequisiteResults;
	startTime: number;
}

export function buildSessionPipeline(e2e: E2EPaths, opts: SessionPipelineOptions, deps: Pick<CliDeps, "disk" | "paths" | "shell" | "proc" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep[] {
	return [
		createEnvConfigStep(opts.config, deps),
		createVitestStep(e2e, deps),
		createReportStep(e2e, deps),
		createSessionNoteStep(e2e, {
			config: opts.config,
			entries: opts.entries,
			prereqResults: opts.prereqResults,
			startTime: opts.startTime,
		}, deps, render),
		createCleanupStep(e2e, deps),
		createEnvCleanupStep(deps),
	];
}
