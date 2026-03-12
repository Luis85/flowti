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

export function createE2ERenderer(): E2ERenderer {
	return {
		prerequisites: printPrerequisites,
		journeyTable: printJourneyTable,
		stepTable: printStepTable,
		executionBanner: printExecutionBanner,
		sessionSummary: printSessionSummary,
		incrementSummary: printIncrementSummary,
		publishSummary: printPublishSummary,
	};
}
