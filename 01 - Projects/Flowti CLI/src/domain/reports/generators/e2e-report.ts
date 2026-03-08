/**
 * e2e-report.ts — Thin entry point for E2E report generation.
 *
 * Delegates to focused modules under ./e2e/ for all logic.
 * This file only handles lazy path resolution and the top-level invocation.
 */

import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { readProjectConfig } from "../../project/project-config.js";
import { resolveE2EPaths, type E2EPaths } from "../../review/e2e-paths.js";
import { generateE2EReport } from "./e2e/e2e-report-summary.js";

// ── Lazy E2E path resolution ────────────────────────────────────

let _e2e: E2EPaths | null = null;
function e2e(): E2EPaths {
	if (!_e2e) {
		const config = readProjectConfig(PLUGIN_ROOT);
		_e2e = resolveE2EPaths(PLUGIN_ROOT, config?.review);
	}
	return _e2e;
}

/** Initialize E2E report paths from a project context. */
export function initE2EReportPaths(projectRoot: string, review?: import("../../../infrastructure/types.js").ReviewConfig): void {
	_e2e = resolveE2EPaths(projectRoot, review);
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

// ── Script entry point ──────────────────────────────────────────
generateE2EReport(e2e());
