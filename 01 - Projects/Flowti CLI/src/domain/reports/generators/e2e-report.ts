/**
 * e2e-report.ts — Thin entry point for E2E report generation.
 *
 * Delegates to focused modules under ./e2e/ for all logic.
 * This file only handles lazy path resolution and the top-level invocation.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { resolveE2EPaths, type E2EPaths } from "../../review/e2e-paths.js";

export type E2EReportDeps = Pick<CliDeps, "disk" | "paths" | "proc">;

/** Initialize E2E report paths from a project context. */
export function initE2EReportPaths(projectRoot: string, vaultRoot: string, deps: E2EReportDeps, review?: import("../../../infrastructure/types.js").ReviewConfig): E2EPaths {
	return resolveE2EPaths(projectRoot, review, vaultRoot, { paths: deps.paths, proc: deps.proc });
}

// Re-export all types and functions for backward compatibility
export type {
	VitestCase, VitestSuite, VitestResults,
	ActionStatsReturn, JourneyEntry, JourneyReportResult,
	StartupPerf, TraceSummary, TraceData, PerfTraceEvent,
	CanvasNode, CanvasEdge, CanvasResult,
	StepAction, StepDefinition, ManualVerification,
	DomSnapshot, RecentEvent, PluginState, ErrorContext, StepResult,
	StartupService, StartupTotal, StorageOp, QueryOp, DispatchOp, AlertOp,
	DispatchAggregate, PerfEventBuckets, JourneyDataFields, CanvasJourneyFields,
	ReconciledTotals,
} from "./e2e/e2e-report-types.js";

export {
	resolveMode, resolveVars, formatDuration, statusCallout, resolveStatus,
	statusLabel, TOOL_COUNTER_MAP, computeActionStats, round, percentile,
	formatBytes, buildStepsSummary,
} from "./e2e/e2e-report-utils.js";

export {
	readVitestResults, readJourneyResults, reconcileResults,
	parseVitestCase, parseVitestSuite, buildJourneyStepMap,
	findMatchingJourney, reconcileCase,
} from "./e2e/e2e-report-vitest.js";

export { generateJourneyReport, extractJourneyFields, buildErrorContextLines } from "./e2e/e2e-report-journey.js";
export { generateJourneyCanvas, formatActionText } from "./e2e/e2e-report-canvas.js";
export { readLatestEventTrace, readStartupPerf, buildPerfLines, buildEventTraceLines, buildPerfEventStats, classifyPerfEvent, parsePerfPayload } from "./e2e/e2e-report-perf.js";
export { generateE2EReport, writeJourneyOutputs, aggregateJourneyStats, computeReconciledTotals, cleanupResults } from "./e2e/e2e-report-summary.js";
export type { E2ESummaryDeps } from "./e2e/e2e-report-summary.js";

