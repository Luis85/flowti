/**
 * e2e-report-summary.ts
 *
 * E2E summary report generation — top-level report with aggregated results.
 */

import { disk } from "../../../../infrastructure/filesystem.js";
import { paths } from "../../../../infrastructure/paths.js";
import { log } from "../../../../infrastructure/logger.js";
import { clock } from "../../../../infrastructure/clock.js";
import { Document } from "../../../../infrastructure/document.js";
import type {
	ActionStatsReturn, ErrorContext, JourneyEntry, JourneyReportResult,
	ReconciledTotals, StartupPerf, StepResult, TraceData,
	VitestCase, VitestResults, VitestSuite,
} from "./e2e-report-types.js";
import type { E2EPaths } from "../../../review/e2e-paths.js";
import {
	buildStepsSummary, computeActionStats, formatDuration,
	percentile, resolveMode, resolveStatus, round,
	statusCallout, statusLabel, TOOL_COUNTER_MAP,
} from "./e2e-report-utils.js";
import { generateJourneyReport } from "./e2e-report-journey.js";
import { generateJourneyCanvas } from "./e2e-report-canvas.js";
import { readVitestResults, readJourneyResults, reconcileResults } from "./e2e-report-vitest.js";
import { buildEventTraceLines, buildPerfLines, readLatestEventTrace, readStartupPerf } from "./e2e-report-perf.js";

// ── File I/O Helpers ────────────────────────────────────────────

/** Writes content to a file and logs the output path. */
function writeReport(dir: string, filename: string, content: string, label: string): void {
	disk.mkdirSync(dir, { recursive: true });
	const outputPath = paths.join(dir, filename);
	disk.writeFileSync(outputPath, content, "utf-8");
	log(`[report] ${label}: ${outputPath}`);
}

/** Copies screenshot .png files from src to dest directory, removing stale dest files first. */
function copyScreenshots(srcDir: string, destDir: string): void {
	if (!disk.existsSync(srcDir)) return;

	disk.mkdirSync(destDir, { recursive: true });

	const srcFiles = new Set(disk.readdirSync(srcDir).filter((f) => f.endsWith(".png")));
	for (const file of disk.readdirSync(destDir)) {
		if (!file.endsWith(".png")) continue;
		if (!srcFiles.has(file)) {
			disk.rmSync(paths.join(destDir, file), { force: true });
		}
	}

	for (const file of srcFiles) {
		disk.copyFileSync(paths.join(srcDir, file), paths.join(destDir, file));
	}
}

// ── Journey Output ──────────────────────────────────────────────

/** Writes a single journey's report, canvas, and screenshots to both vaults. */
export function writeJourneyOutputs(
	dir: string, data: Record<string, unknown>, date: string, now: Date, trace: TraceData | null,
	e2e: E2EPaths,
): JourneyReportResult {
	const { title, status: jReportStatus, content } = generateJourneyReport(data, date);
	const filename = `${title}.md`;
	const canvasFilename = `${title}.canvas`;

	writeReport(dir, filename, content, "JourneyReport written");

	const testScreenshotPath = `docs/journeys/${title}/screenshots`;
	const testConfigPath = `docs/journeys/${title}/${title}-config.json`;
	const testCanvas = generateJourneyCanvas(data, testScreenshotPath, trace, testConfigPath);
	writeReport(dir, canvasFilename, JSON.stringify(testCanvas, null, "\t"), "JourneyCanvas written");

	const devContent = content.replace(/!\[\[([^\]]+\.png)\]\]/g, (_: string, file: string) => `![](screenshots/${file})`);
	const devJourneyDir = paths.join(e2e.devJourneysDir, title);
	writeReport(devJourneyDir, filename, devContent, "JourneyReport mirrored");

	const configFile = paths.join(dir, `${title}-config.json`);
	if (disk.existsSync(configFile)) {
		writeReport(devJourneyDir, `${title}-config.json`, disk.readFileSync(configFile, "utf-8"), "JourneyConfig mirrored");
	}

	const devScreenshotPath = `Development/flowti/docs/journeys/${title}/screenshots`;
	const devConfigPath = `Development/flowti/docs/journeys/${title}/${title}-config.json`;
	const devCanvas = generateJourneyCanvas(data, devScreenshotPath, trace, devConfigPath);
	writeReport(devJourneyDir, canvasFilename, JSON.stringify(devCanvas, null, "\t"), "JourneyCanvas mirrored");

	const archivedContent = content.replace(/!\[\[([^\]]+\.png)\]\]/g, (_: string, file: string) => `![](../screenshots/${file})`);
	const safeTs = now.toISOString().replace(/:/g, "-");
	const archiveSuffix = jReportStatus === "partial-pass" ? " (Partial)" : "";
	const pastTestsDir = paths.join(devJourneyDir, "past-tests");
	writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.md`, archivedContent, "JourneyReport archived");
	writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.canvas`, JSON.stringify(devCanvas, null, "\t"), "JourneyCanvas archived");

	copyScreenshots(paths.join(dir, "screenshots"), paths.join(devJourneyDir, "screenshots"));

	return { title, status: jReportStatus, content };
}

// ── Aggregation ─────────────────────────────────────────────────

/** Aggregates action stats across all journeys and returns per-journey stats map. */
export function aggregateJourneyStats(journeys: JourneyEntry[]): {
	aggregate: ActionStatsReturn & { tools_set: Set<string> };
	perJourney: Map<string, ActionStatsReturn>;
} {
	const agg = {
		total: 0, screenshots: 0, assertions: 0, manual_checks: 0, manual_passed: 0, manual_failed: 0,
		visual_inspections: 0, notices: 0, theme_changes: 0,
		create_files: 0, delete_files: 0, open_files: 0, close_leaves: 0,
		tools: [] as string[], tools_set: new Set<string>(),
	};
	const perJourney = new Map<string, ActionStatsReturn>();
	for (const { data } of journeys) {
		const stats = computeActionStats(data);
		for (const key of Object.keys(TOOL_COUNTER_MAP) as Array<keyof typeof TOOL_COUNTER_MAP>) {
			const field = TOOL_COUNTER_MAP[key];
			(agg[field] as number) += stats[field] as number;
		}
		agg.total += stats.total;
		agg.manual_passed += stats.manual_passed;
		agg.manual_failed += stats.manual_failed;
		for (const t of stats.tools) agg.tools_set.add(t);
		perJourney.set(data.journey as string, stats);
	}
	agg.tools = [...agg.tools_set].sort();
	return { aggregate: agg, perJourney };
}

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

function buildE2EFrontmatter(
	doc: InstanceType<typeof Document>,
	opts: {
		date: string; totalTests: number; totalPassed: number; totalFailed: number;
		totalSkipped: number; totalDev: number; totalDurationMs: number; overallStatus: string;
		aggregate: ActionStatsReturn; allTools: string[];
		testSuiteLinks: string[]; journeyReportLinks: string[]; journeyCanvasLinks: string[];
		journeyCount: number; trace: TraceData | null; startupPerf: StartupPerf | null;
	},
): void {
	doc.mergeFrontmatter({
		type: "E2EReport", mode: resolveMode(), date: opts.date,
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

// ── Failure / Warning Rendering ─────────────────────────────────

function appendCompactDomLines(lines: string[], ctx: ErrorContext): void {
	if (!ctx.domSnapshot) return;
	const ds = ctx.domSnapshot;
	lines.push(`View: \`${ds.activeViewType}\` | Leaves: ${ds.leafCount} | Modal: ${ds.hasModal ? "yes" : "no"}`);
	if (ds.notices && ds.notices.length > 0) {
		lines.push(`Notices: ${ds.notices.map((n) => `\`${n.substring(0, 80)}\``).join(", ")}`);
	}
}

function appendCompactEventsAndErrors(lines: string[], ctx: ErrorContext): void {
	if (ctx.recentEvents && ctx.recentEvents.length > 0) {
		lines.push("", "**Recent Events**:");
		for (const e of ctx.recentEvents) lines.push(`- \`${e.type}\` (${e.relativeMs}ms ago)`);
	}
	if (ctx.consoleErrors && ctx.consoleErrors.length > 0) {
		lines.push("", "**Console Errors**:");
		for (const e of ctx.consoleErrors) lines.push(`- \`${e.substring(0, 120)}\``);
	}
	if (ctx.pluginState) {
		lines.push("", `Plugin: loaded=${ctx.pluginState.loaded}, services=${ctx.pluginState.serviceCount}`);
	}
}

export function buildCompactTraceLines(ctx: ErrorContext): string[] {
	const lines: string[] = [];
	appendCompactDomLines(lines, ctx);
	appendCompactEventsAndErrors(lines, ctx);
	return lines;
}

export function collectVitestFailures(vitest: VitestResults | null): Array<{ suite: string; testCase: VitestCase; hookError: string | null }> {
	if (!vitest) return [];
	const failures: Array<{ suite: string; testCase: VitestCase; hookError: string | null }> = [];
	for (const suite of vitest.suites) {
		for (const c of suite.cases) {
			if (c.status === "failed") failures.push({ suite: suite.name, testCase: c, hookError: suite.hookError });
		}
		if (suite.suiteHookFailed && suite.cases.filter((c) => c.status === "failed").length === 0) {
			failures.push({
				suite: suite.name,
				testCase: { name: "Hook failure (beforeAll)", status: "failed", durationMs: 0, error: suite.hookError },
				hookError: suite.hookError,
			});
		}
	}
	return failures;
}

function renderFailedStepEntry(doc: InstanceType<typeof Document>, journeyTitle: string, stepResult: StepResult): void {
	const stepLabel = `Step ${stepResult.step.guideSection}: ${stepResult.step.title}`;
	doc.heading(3, `${stepLabel} [FAIL]`).addBlank();
	const dangerLines: string[] = [];
	if (stepResult.error) dangerLines.push(`**Error**: ${stepResult.error}`);
	doc.callout("danger", `${journeyTitle} — ${stepLabel} (${formatDuration(stepResult.durationMs)})`, dangerLines);
	doc.addBlank();
	if (stepResult.errorContext) {
		doc.callout("bug", "Trace", buildCompactTraceLines(stepResult.errorContext));
		doc.addBlank();
	}
	doc.text(`Details: [[${journeyTitle}#${stepLabel} FAIL]] | Canvas: [[${journeyTitle}.canvas|Canvas]]`);
	doc.addBlank();
}

function renderVitestFailuresSubsection(
	doc: InstanceType<typeof Document>,
	vitestFailures: Array<{ suite: string; testCase: VitestCase; hookError: string | null }>,
	hasJourneyFailures: boolean,
): void {
	if (vitestFailures.length === 0) return;
	if (hasJourneyFailures) doc.addSeparator().addBlank();
	doc.heading(3, hasJourneyFailures ? "Vitest Failures (not captured by journey runner)" : "Test Runner Failures").addBlank();
	for (const { suite, testCase, hookError } of vitestFailures) {
		const dur = testCase.durationMs > 0 ? ` (${formatDuration(testCase.durationMs)})` : "";
		const vtLines: string[] = [];
		if (testCase.error) vtLines.push(`**Error**: ${testCase.error.split("\n")[0].substring(0, 200)}`);
		if (hookError && !testCase.error) vtLines.push(`**Hook error**: ${hookError.split("\n")[0].substring(0, 200)}`);
		doc.callout("danger", `${suite} — ${testCase.name}${dur}`, vtLines);
		doc.addBlank();
	}
}

function renderFailuresSection(
	doc: InstanceType<typeof Document>,
	failedSteps: Array<{ journeyTitle: string; stepResult: StepResult }>,
	vitestFailures: Array<{ suite: string; testCase: VitestCase; hookError: string | null }>,
): void {
	const totalFailures = failedSteps.length + vitestFailures.length;
	if (totalFailures === 0) return;

	doc.addSeparator().addBlank();
	doc.heading(2, `Failures (${totalFailures})`).addBlank();
	for (const { journeyTitle, stepResult } of failedSteps) renderFailedStepEntry(doc, journeyTitle, stepResult);
	renderVitestFailuresSubsection(doc, vitestFailures, failedSteps.length > 0);
}

function renderWarningsSection(doc: InstanceType<typeof Document>, journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): void {
	const stepsWithWarnings: Array<{ journeyTitle: string; stepResult: StepResult }> = [];
	for (const { title, data } of journeyReportNames) {
		for (const sr of ((data.steps as StepResult[]) ?? [])) {
			if (sr.warnings && sr.warnings.length > 0) stepsWithWarnings.push({ journeyTitle: title, stepResult: sr });
		}
	}
	if (stepsWithWarnings.length === 0) return;

	doc.addSeparator().addBlank();
	doc.heading(2, `Warnings (${stepsWithWarnings.length})`).addBlank();
	for (const { journeyTitle, stepResult } of stepsWithWarnings) {
		const stepLabel = `Step ${stepResult.step.guideSection}: ${stepResult.step.title}`;
		const warnLines = stepResult.warnings!.map((w) => {
			const match = w.match(/\nReason:\s*(.+)/);
			return match ? match[1].trim() : w;
		});
		doc.callout("warning", `${journeyTitle} — ${stepLabel}`, warnLines);
		doc.addBlank();
	}
}

// ── Action Coverage ─────────────────────────────────────────────

export function buildJourneyStatsLine(stats: ActionStatsReturn): string {
	const lc = stats.create_files + stats.delete_files + stats.open_files + stats.close_leaves;
	return `Actions: ${stats.total} | Screenshots: ${stats.screenshots} | Assertions: ${stats.assertions} | Manual: ${stats.manual_checks}` +
		(stats.visual_inspections > 0 ? ` | Visual: ${stats.visual_inspections}` : "") +
		` | Notices: ${stats.notices}` +
		(stats.theme_changes > 0 ? ` | Themes: ${stats.theme_changes}` : "") +
		(lc > 0 ? ` | Lifecycle: ${lc}` : "");
}

function renderActionCoverageSection(
	doc: InstanceType<typeof Document>,
	aggregate: ActionStatsReturn, allTools: string[], journeyCount: number,
	journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>,
	perJourneyStats: Map<string, ActionStatsReturn>,
): void {
	if (aggregate.total === 0) return;
	doc.addSeparator().addBlank();
	doc.heading(2, "Action Coverage").addBlank();
	const lc = aggregate.create_files + aggregate.delete_files + aggregate.open_files + aggregate.close_leaves;
	doc.callout("abstract", `${aggregate.total} actions across ${journeyCount} journeys`, [
		`Screenshots: **${aggregate.screenshots}** | Assertions: **${aggregate.assertions}** | Manual QA: **${aggregate.manual_checks}**` +
		(aggregate.visual_inspections > 0 ? ` | Visual: **${aggregate.visual_inspections}**` : "") +
		` | Notices: **${aggregate.notices}**` +
		(aggregate.theme_changes > 0 ? ` | Themes: **${aggregate.theme_changes}**` : "") +
		(lc > 0 ? ` | Lifecycle: **${lc}**` : ""),
		`Tools: ${allTools.map((t) => `\`${t}\``).join(" ")}`,
	]);
	doc.addBlank();

	if (journeyReportNames.length > 1) {
		const rows: string[][] = [];
		for (const { title, data } of journeyReportNames) {
			const stats = perJourneyStats.get(data.journey as string);
			if (!stats) continue;
			const slc = stats.create_files + stats.delete_files + stats.open_files + stats.close_leaves;
			rows.push([`[[${title}]]`, String(stats.total), String(stats.screenshots), String(stats.assertions), String(stats.manual_checks), String(stats.notices), String(slc), String(stats.tools.length)]);
		}
		doc.table(["Journey", "Actions", "Screenshots", "Assertions", "Manual", "Notices", "Lifecycle", "Tools"], rows);
		doc.addBlank();
	}
}

// ── Test Suites ─────────────────────────────────────────────────

export function caseMarkAndSuffix(status: string, caseName: string, warningItBlocks: Set<string>, suiteHookFailed: boolean): { mark: string; suffix: string } {
	if (status === "passed") {
		const hasWarning = warningItBlocks.size > 0 && [...warningItBlocks].some((w) => caseName.includes(w));
		return { mark: hasWarning ? "[~]" : "[x]", suffix: "" };
	}
	if (status === "failed") return { mark: "[!]", suffix: "" };
	if (status === "skipped") return { mark: "[-]", suffix: " — *Skipped (previous run passed)*" };
	if (status === "dev") return { mark: "[-]", suffix: " — *Dev (not yet implemented)*" };
	return { mark: suiteHookFailed ? "[ ]" : "[-]", suffix: "" };
}

export function collectWarningItBlocks(journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): Set<string> {
	const warningItBlocks = new Set<string>();
	for (const { data } of journeyReportNames) {
		for (const sr of ((data.steps as StepResult[]) ?? [])) {
			if (sr.warnings && sr.warnings.length > 0) {
				warningItBlocks.add(sr.step.itBlock ?? `${sr.step.guideSection} — ${sr.step.title}`);
			}
		}
	}
	return warningItBlocks;
}

function renderSuiteHeader(doc: InstanceType<typeof Document>, suite: VitestSuite): void {
	const sPassed = suite.reconciledPassed ?? suite.passed;
	const sFailed = suite.reconciledFailed ?? suite.failed;
	const sSkipped = suite.reconciledSkipped ?? suite.skipped;
	const sDev = suite.reconciledDev ?? 0;
	const sTotal = suite.cases.length;

	doc.heading(3, suite.name).addBlank();
	const summaryParts = [`${sPassed}/${sTotal} passed`];
	if (sSkipped > 0) summaryParts.push(`${sSkipped} skipped`);
	if (sDev > 0) summaryParts.push(`${sDev} dev`);
	const hookLines: string[] = [];
	if (suite.hookError) hookLines.push(`**Hook failure**: ${suite.hookError.split("\n")[0].substring(0, 200)}`);
	const suiteStatus = resolveStatus(sPassed, sFailed, sTotal, sSkipped + sDev);
	doc.callout(statusCallout(suiteStatus), `${statusLabel(suiteStatus)} — ${summaryParts.join(", ")}`, hookLines);
	doc.addBlank();
}

function renderSuiteCases(doc: InstanceType<typeof Document>, suite: VitestSuite, warningItBlocks: Set<string>): void {
	for (const c of suite.cases) {
		const status = c.reconciledStatus ?? c.status;
		const { mark, suffix } = caseMarkAndSuffix(status, c.name, warningItBlocks, suite.suiteHookFailed);
		const dur = c.durationMs > 0 ? ` (${formatDuration(c.durationMs)})` : "";
		const blocked = suite.suiteHookFailed && status !== "passed" && status !== "failed" ? " — *blocked*" : "";
		const displayName = c.name.includes(" > ") ? c.name.substring(c.name.lastIndexOf(" > ") + 3) : c.name;
		doc.text(`- ${mark} ${displayName}${dur}${blocked}${suffix}`);
		if (c.error) doc.text(`  > Error: ${c.error.split("\n")[0]}`);
	}
	doc.addBlank();
}

function renderTestSuitesSection(
	doc: InstanceType<typeof Document>, reconciled: VitestResults,
	journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>,
): void {
	doc.addSeparator().addBlank();
	doc.heading(2, "Test Suites").addBlank();

	const warningItBlocks = collectWarningItBlocks(journeyReportNames);
	for (const suite of reconciled.suites) {
		renderSuiteHeader(doc, suite);
		renderSuiteCases(doc, suite, warningItBlocks);
	}
}

// ── Journeys Summary ────────────────────────────────────────────

export function resolveJourneyStatus(data: Record<string, unknown>): { status: string; suffix: string; stepsSummary: string } {
	const jSkipped = (data.skipped as number) ?? 0;
	const jDevStopped = (data.devStopped as boolean) === true;
	const jPassed = (data.passed as number) ?? 0;
	const jTotal = (data.totalSteps as number) ?? 0;
	const status = resolveStatus(jPassed, (data.failed as number) ?? 0, jTotal, jSkipped, false, jDevStopped);
	const suffix = status === "partial-pass" ? " (Partial)" : status === "dev-stopped" ? " (Dev)" : "";
	const stepsSummary = buildStepsSummary(jPassed, jTotal, jSkipped, (data.dev as number) ?? 0, jDevStopped);
	return { status, suffix, stepsSummary };
}

function renderSingleJourneySummary(
	doc: InstanceType<typeof Document>, title: string, data: Record<string, unknown>, stats: ActionStatsReturn | undefined,
): void {
	const j = resolveJourneyStatus(data);
	doc.heading(3, `Journey: ${title}${j.suffix}`).addBlank();
	const jCalloutLines: string[] = [];
	if (stats && stats.total > 0) jCalloutLines.push(buildJourneyStatsLine(stats));
	doc.callout(statusCallout(j.status), `${statusLabel(j.status)} — ${j.stepsSummary} | ${formatDuration((data.durationMs as number) ?? 0)}`, jCalloutLines);
	doc.addBlank();
	doc.text(`Full details: [[${title}]] | Canvas: [[${title}.canvas|Canvas]]`);
	doc.addBlank();
}

function renderJourneysSummarySection(
	doc: InstanceType<typeof Document>,
	journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>,
	perJourneyStats: Map<string, ActionStatsReturn>,
): void {
	if (journeyReportNames.length === 0) return;
	doc.addSeparator().addBlank();
	doc.heading(2, "Journeys").addBlank();
	for (const { title, data } of journeyReportNames) {
		renderSingleJourneySummary(doc, title, data, perJourneyStats.get(data.journey as string));
	}
}

// ── Reconciled Totals ───────────────────────────────────────────

const EMPTY_COUNTS = { totalPassed: 0, totalFailed: 0, totalSkipped: 0, totalDev: 0, totalTests: 0 } as const;

function extractReconciledCounts(reconciled: ReturnType<typeof reconcileResults>): { totalPassed: number; totalFailed: number; totalSkipped: number; totalDev: number; totalTests: number } {
	if (!reconciled) return { ...EMPTY_COUNTS };
	const { totalPassed, totalFailed, totalSkipped, totalDev = 0, totalTests } = reconciled;
	return { totalPassed, totalFailed, totalSkipped, totalDev, totalTests };
}

export function computeReconciledTotals(vitest: VitestResults | null, journeys: JourneyEntry[]): ReconciledTotals {
	const counts = extractReconciledCounts(reconcileResults(vitest, journeys));
	const effectiveSkipped = counts.totalSkipped + counts.totalDev + (resolveMode() !== "full" ? 1 : 0);
	const hasJourneyWarnings = journeys.some(({ data }) => ((data.steps as StepResult[]) ?? []).some((r) => r.warnings && r.warnings.length > 0));
	const overallStatus = resolveStatus(counts.totalPassed, counts.totalFailed, counts.totalTests, effectiveSkipped, hasJourneyWarnings);
	return { ...counts, overallStatus, totalDurationMs: vitest?.durationMs ?? 0 };
}

export function collectFailedSteps(journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): Array<{ journeyTitle: string; stepResult: StepResult }> {
	const failedSteps: Array<{ journeyTitle: string; stepResult: StepResult }> = [];
	for (const { title, data } of journeyReportNames) {
		for (const sr of ((data.steps as StepResult[]) ?? [])) {
			if (sr.status === "fail") failedSteps.push({ journeyTitle: title, stepResult: sr });
		}
	}
	return failedSteps;
}

// ── E2E Doc Body ────────────────────────────────────────────────

function renderE2EDocBody(
	doc: InstanceType<typeof Document>, totals: ReconciledTotals,
	vitest: VitestResults | null, journeys: JourneyEntry[],
	journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>,
	aggregate: ActionStatsReturn, allTools: string[],
	perJourneyStats: Map<string, ActionStatsReturn>,
	startupPerf: StartupPerf | null, trace: TraceData | null,
	e2e: E2EPaths,
): void {
	doc.addBlank().heading(1, `E2E Report${totals.overallStatus === "partial-pass" ? " (Partial)" : ""}`).addBlank();
	doc.callout(statusCallout(totals.overallStatus), `Summary — ${statusLabel(totals.overallStatus)}`, [
		`Mode: **${resolveMode()}** | Tests: ${totals.totalTests} | Passed: ${totals.totalPassed} | Failed: ${totals.totalFailed} | Skipped: ${totals.totalSkipped}` + (totals.totalDev > 0 ? ` | Dev: ${totals.totalDev}` : ""),
		`Duration: ${formatDuration(totals.totalDurationMs)}`,
	]);
	doc.addBlank();

	renderFailuresSection(doc, collectFailedSteps(journeyReportNames), collectVitestFailures(vitest));
	renderWarningsSection(doc, journeyReportNames);
	renderActionCoverageSection(doc, aggregate, allTools, journeys.length, journeyReportNames, perJourneyStats);

	if (vitest && vitest.suites.length > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Units Under Test").addBlank();
		doc.list(vitest.suites.map((s) => `\`${paths.relative(e2e.projectRoot, s.file).replace(/\\/g, "/")}\``));
		doc.addBlank();
	}

	const reconciled = reconcileResults(vitest, journeys);
	if (reconciled) renderTestSuitesSection(doc, reconciled, journeyReportNames);

	buildPerfLines(startupPerf, doc);
	buildEventTraceLines(trace, doc);
	renderJourneysSummarySection(doc, journeyReportNames, perJourneyStats);
}

// ── Output Writing ──────────────────────────────────────────────

function writeE2EOutputs(content: string, now: Date, overallStatus: string, e2e: E2EPaths): void {
	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const e2eFilename = `${safeTimestamp}-e2e-report${overallStatus === "partial-pass" ? " (Partial)" : ""}.md`;
	writeReport(e2e.testVault, "E2E Report.md", content, "E2EReport written");
	writeReport(paths.join(e2e.projectRoot, "docs", "reports", "e2e"), "E2E Report.md", content, "E2EReport current");
	writeReport(e2e.devRunsDir, e2eFilename, content, "E2EReport archived");
}

/** Cleans up temporary result files after report generation. */
export function cleanupResults(journeys: JourneyEntry[], vitestResultsPath: string): void {
	try { if (disk.existsSync(vitestResultsPath)) disk.rmSync(vitestResultsPath, { force: true }); } catch { /* ignore */ }
	for (const { dir, data } of journeys) {
		try { disk.rmSync(paths.join(dir, `${(data.journey as string)}-results.json`), { force: true }); } catch { /* ignore */ }
	}
}

function generateJourneyReports(
	journeys: JourneyEntry[], date: string, now: Date, trace: TraceData | null, e2e: E2EPaths,
): Array<{ title: string; data: Record<string, unknown> }> {
	const journeyReportNames: Array<{ title: string; data: Record<string, unknown> }> = [];
	for (const { dir, data } of journeys) {
		const result = writeJourneyOutputs(dir, data, date, now, trace, e2e);
		journeyReportNames.push({ title: result.title, data });
	}
	return journeyReportNames;
}

// ── Main Entry Point ────────────────────────────────────────────

export function generateE2EReport(e2e: E2EPaths): void {
	const vitestResultsPath = e2e.vitestResults;
	const journeysDir = paths.join(e2e.testVault, "docs", "journeys");

	const vitest = readVitestResults(vitestResultsPath);
	const journeys = readJourneyResults(journeysDir);

	if (!vitest && journeys.length === 0) {
		log("[report] No E2E results found — run E2E tests first.");
		return;
	}

	const now = clock.now();
	const date = now.toISOString();
	const startupPerf = readStartupPerf(e2e.dataJsonCandidates);
	const trace = readLatestEventTrace(e2e.devTracesDir);

	const journeyReportNames = generateJourneyReports(journeys, date, now, trace, e2e);
	const totals = computeReconciledTotals(vitest, journeys);
	const { aggregate, perJourney: perJourneyStats } = aggregateJourneyStats(journeys);
	const allTools = aggregate.tools;

	const doc = Document.create("E2E Report");
	const testSuiteLinks = (vitest?.suites ?? []).map((s) => `[[${paths.relative(e2e.projectRoot, s.file).replace(/\\/g, "/")}]]`);

	buildE2EFrontmatter(doc, {
		date, ...totals, aggregate, allTools, testSuiteLinks,
		journeyReportLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCanvasLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCount: journeys.length, trace, startupPerf,
	});

	renderE2EDocBody(doc, totals, vitest, journeys, journeyReportNames, aggregate, allTools, perJourneyStats, startupPerf, trace, e2e);
	writeE2EOutputs(doc.toString(), now, totals.overallStatus, e2e);
	cleanupResults(journeys, vitestResultsPath);
}
