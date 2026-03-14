/**
 * e2e-renderer-impl.ts — Default ANSI renderer for E2E domain output.
 *
 * Delegates to the existing e2e-formatters functions.
 * This lives in the UI layer — it's the only place that imports formatters.
 */

import type { E2ERenderer } from "../../domain/e2e/e2e-renderer.js";
import {
	printPrerequisites,
	printJourneyTable,
	printStepTable,
	printExecutionBanner,
	printSessionSummary,
	printIncrementSummary,
	printPublishSummary,
} from "./e2e-formatters.js";

export function createE2ERenderer(log: (msg?: string) => void): E2ERenderer {
	return {
		prerequisites: (results, e2e) => printPrerequisites(results, e2e, log),
		journeyTable: (entries) => printJourneyTable(entries, log),
		stepTable: (def, steps) => printStepTable(def, steps, log),
		executionBanner: (config, selectedNames) => printExecutionBanner(config, selectedNames, log),
		sessionSummary: (sessionName, selectedNames, startTime, stats) => printSessionSummary(sessionName, selectedNames, startTime, stats, log),
		incrementSummary: (exitCode, duration, stats) => printIncrementSummary(exitCode, duration, stats, log),
		publishSummary: (exitCode, duration, stats) => printPublishSummary(exitCode, duration, stats, log),
	};
}
