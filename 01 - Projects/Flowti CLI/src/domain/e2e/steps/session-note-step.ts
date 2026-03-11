/**
 * session-note-step.ts — PipelineStep for writing the E2E session note.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { PipelineStep, StepOutput, PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";
import type { E2EPaths } from "../e2e-paths.js";
import type { SessionConfig, JourneyEntry, PrerequisiteResults, TestStats } from "../e2e-types.js";
import { writeSessionNote } from "../e2e-session-note.js";
import { readTestStats } from "../e2e-build.js";
import { resolveJourneyNames } from "../e2e-session.js";
import type { E2ERenderer } from "../e2e-renderer.js";
import { nullRenderer } from "../e2e-renderer.js";

export interface SessionNoteStepOptions {
	config: SessionConfig;
	entries: JourneyEntry[];
	prereqResults: PrerequisiteResults;
	startTime: number;
}

export function createSessionNoteStep(e2e: E2EPaths, opts: SessionNoteStepOptions, deps: Pick<CliDeps, "disk" | "paths" | "clock" | "log">, render: E2ERenderer = nullRenderer): PipelineStep {
	return {
		id: "e2e:session-note",
		label: "Session Note",
		dependencies: ["e2e:vitest"],
		execute(ctx: PipelineContext): StepOutput {
			const vitestData = ctx.getStepData("e2e:vitest") as { exitCode: number } | undefined;
			const exitCode = vitestData?.exitCode ?? 1;
			const stats: TestStats = readTestStats(e2e, deps);
			const selectedNames = resolveJourneyNames(opts.config.selectedSlugs, opts.entries);

			render.sessionSummary(opts.config.sessionName, selectedNames, opts.startTime, stats);

			const notePath = writeSessionNote(
				opts.config.sessionName,
				opts.config,
				selectedNames,
				opts.prereqResults,
				stats,
				opts.startTime,
				exitCode,
				e2e,
				deps,
			);

			ctx.log(`  Session note: ${notePath}\n`);

			return {
				success: true,
				outputPath: notePath,
				metrics: {
					tests: stats.totalTests,
					passed: stats.passed,
					failed: stats.failed,
				},
				data: { notePath, stats, exitCode },
			};
		},
	};
}
