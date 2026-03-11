/**
 * e2e-report-frontmatter.ts
 *
 * Frontmatter builders for the E2E summary report.
 */

import type { CliDeps } from "../../../../infrastructure/deps.js";
import type { Document } from "../../../../infrastructure/document.js";
import type { ActionStatsReturn, StartupPerf, TraceData } from "./e2e-report-types.js";
import { formatDuration, percentile, resolveMode, round } from "./e2e-report-utils.js";

// ── Frontmatter ─────────────────────────────────────────────────

function setE2EActionFrontmatter(doc: InstanceType<typeof Document>, aggregate: ActionStatsReturn, allTools: string[]): void {
	doc.mergeFrontmatter({
		total_actions: aggregate.total, total_screenshots: aggregate.screenshots,
		total_assertions: aggregate.assertions, total_manual_checks: aggregate.manual_checks,
	});
	if (aggregate.manual_passed > 0) doc.setFrontmatter("total_manual_passed", aggregate.manual_passed);
	if (aggregate.manual_failed > 0) doc.setFrontmatter("total_manual_failed", aggregate.manual_failed);
	doc.mergeFrontmatter({
		total_visual_inspections: aggregate.visual_inspections, total_notices: aggregate.notices,
		total_theme_changes: aggregate.theme_changes, total_create_files: aggregate.create_files,
		total_delete_files: aggregate.delete_files, total_open_files: aggregate.open_files, total_close_leaves: aggregate.close_leaves,
	});
	if (allTools.length > 0) doc.setFrontmatter("tools", allTools);
	else doc.setRawFrontmatter("tools", "[]");
}

function setE2ELinksFrontmatter(doc: InstanceType<typeof Document>, opts: { testSuiteLinks: string[]; journeyReportLinks: string[]; journeyCanvasLinks: string[] }): void {
	doc.setFrontmatter("test_suites", opts.testSuiteLinks);
	doc.setFrontmatter("journey_reports", opts.journeyReportLinks);
	doc.setFrontmatter("journey_canvases", opts.journeyCanvasLinks);
	doc.setRawFrontmatter("event_trace", '"[[Event Trace]]"');
	doc.setRawFrontmatter("event_trace_json", '"[[Event Trace.json]]"');
	doc.setRawFrontmatter("event_trace_csv", '"[[Event Trace.csv]]"');
}

function buildE2EMetricsFrontmatter(
	doc: InstanceType<typeof Document>,
	opts: {
		totalDurationMs: number; overallStatus: string; journeyCount: number;
		trace: TraceData | null; startupPerf: StartupPerf | null;
	},
): void {
	doc.mergeFrontmatter({
		duration_ms: opts.totalDurationMs, duration: formatDuration(opts.totalDurationMs),
		journeys: opts.journeyCount, status: opts.overallStatus,
		success: opts.overallStatus === "pass" || opts.overallStatus === "partial-pass",
		trace_events: opts.trace?.summary?.totalEvents ?? 0,
		trace_perf_events: opts.trace?.summary?.perfEvents ?? 0,
		startup_p50: opts.startupPerf ? round(percentile([...opts.startupPerf.history].sort((a, b) => a - b), 0.5)) : 0,
	});
}

export function buildE2EFrontmatter(
	doc: InstanceType<typeof Document>,
	opts: {
		date: string; totalTests: number; totalPassed: number; totalFailed: number;
		totalSkipped: number; totalDev: number; totalDurationMs: number; overallStatus: string;
		aggregate: ActionStatsReturn; allTools: string[];
		testSuiteLinks: string[]; journeyReportLinks: string[]; journeyCanvasLinks: string[];
		journeyCount: number; trace: TraceData | null; startupPerf: StartupPerf | null;
	},
	deps: Pick<CliDeps, "proc">,
): void {
	doc.mergeFrontmatter({
		type: "E2EReport", mode: resolveMode(deps), date: opts.date,
		total_tests: opts.totalTests, passed: opts.totalPassed, failed: opts.totalFailed, skipped: opts.totalSkipped,
	});
	if (opts.totalDev > 0) doc.setFrontmatter("dev", opts.totalDev);
	setE2EActionFrontmatter(doc, opts.aggregate, opts.allTools);
	buildE2EMetricsFrontmatter(doc, opts);
	setE2ELinksFrontmatter(doc, opts);
	const tags = ["report", "e2e"];
	if (opts.overallStatus === "partial-pass") tags.push("partial");
	doc.setTags(tags);
}
