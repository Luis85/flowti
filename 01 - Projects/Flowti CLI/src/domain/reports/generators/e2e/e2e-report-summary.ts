/**
 * e2e-report-summary.ts
 *
 * E2E summary report generation — top-level report with aggregated results.
 */

import type { CliDeps } from "../../../../infrastructure/deps.js";
import { Document } from "../../../../infrastructure/document.js";
import type {
	ActionStatsReturn, JourneyEntry, JourneyReportResult,
	ReconciledTotals, StartupPerf, StepResult, TraceData,
	VitestResults,
} from "./e2e-report-types.js";
import type { E2EPaths } from "../../../review/e2e-paths.js";
import {
	computeActionStats, formatDuration,
	resolveMode, resolveStatus,
	statusCallout, statusLabel, TOOL_COUNTER_MAP,
} from "./e2e-report-utils.js";

export type E2ESummaryDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "proc">;
import { generateJourneyReport } from "./e2e-report-journey.js";
import { generateJourneyCanvas } from "./e2e-report-canvas.js";
import { readVitestResults, readJourneyResults, reconcileResults } from "./e2e-report-vitest.js";
import { buildEventTraceLines, buildPerfLines, readLatestEventTrace, readStartupPerf } from "./e2e-report-perf.js";
import {
	collectVitestFailures,
	renderActionCoverageSection, renderFailuresSection,
	renderJourneysSummarySection, renderTestSuitesSection,
	renderWarningsSection,
} from "./e2e-report-sections.js";
import { buildE2EFrontmatter } from "./e2e-report-frontmatter.js";

// ── File I/O Helpers ────────────────────────────────────────────

export type IODeps = Pick<CliDeps, "disk" | "paths">;

/** Writes content to a file. */
function writeReport(dir: string, filename: string, content: string, deps: IODeps, _label?: string): void {
	deps.disk.mkdirSync(dir, { recursive: true });
	const outputPath = deps.paths.join(dir, filename);
	deps.disk.writeFileSync(outputPath, content, "utf-8");
}

/** Copies screenshot .png files from src to dest directory, removing stale dest files first. */
function copyScreenshots(srcDir: string, destDir: string, deps: IODeps): void {
	if (!deps.disk.existsSync(srcDir)) return;

	deps.disk.mkdirSync(destDir, { recursive: true });

	const srcFiles = new Set(deps.disk.readdirSync(srcDir).filter((f) => f.endsWith(".png")));
	for (const file of deps.disk.readdirSync(destDir)) {
		if (!file.endsWith(".png")) continue;
		if (!srcFiles.has(file)) {
			deps.disk.rmSync(deps.paths.join(destDir, file), { force: true });
		}
	}

	for (const file of srcFiles) {
		deps.disk.copyFileSync(deps.paths.join(srcDir, file), deps.paths.join(destDir, file));
	}
}

// ── Journey Output ──────────────────────────────────────────────

/** Writes a single journey's report, canvas, and screenshots to both vaults. */
export function writeJourneyOutputs(
	dir: string, data: Record<string, unknown>, date: string, now: Date, trace: TraceData | null,
	e2e: E2EPaths, deps: IODeps & Pick<CliDeps, "proc">,
): JourneyReportResult {
	const { title, status: jReportStatus, content } = generateJourneyReport(data, date, deps);
	const filename = `${title}.md`;
	const canvasFilename = `${title}.canvas`;

	writeReport(dir, filename, content, deps, "JourneyReport written");

	const testScreenshotPath = `docs/journeys/${title}/screenshots`;
	const testConfigPath = `docs/journeys/${title}/${title}-config.json`;
	const testCanvas = generateJourneyCanvas(data, testScreenshotPath, trace, testConfigPath);
	writeReport(dir, canvasFilename, JSON.stringify(testCanvas, null, "\t"), deps, "JourneyCanvas written");

	const devContent = content.replace(/!\[\[([^\]]+\.png)\]\]/g, (_: string, file: string) => `![](screenshots/${file})`);
	const devJourneyDir = deps.paths.join(e2e.devJourneysDir, title);
	writeReport(devJourneyDir, filename, devContent, deps, "JourneyReport mirrored");

	const configFile = deps.paths.join(dir, `${title}-config.json`);
	if (deps.disk.existsSync(configFile)) {
		writeReport(devJourneyDir, `${title}-config.json`, deps.disk.readFileSync(configFile, "utf-8"), deps, "JourneyConfig mirrored");
	}

	const devScreenshotPath = `Development/flowti/docs/journeys/${title}/screenshots`;
	const devConfigPath = `Development/flowti/docs/journeys/${title}/${title}-config.json`;
	const devCanvas = generateJourneyCanvas(data, devScreenshotPath, trace, devConfigPath);
	writeReport(devJourneyDir, canvasFilename, JSON.stringify(devCanvas, null, "\t"), deps, "JourneyCanvas mirrored");

	const archivedContent = content.replace(/!\[\[([^\]]+\.png)\]\]/g, (_: string, file: string) => `![](../screenshots/${file})`);
	const safeTs = now.toISOString().replace(/:/g, "-");
	const archiveSuffix = jReportStatus === "partial-pass" ? " (Partial)" : "";
	const pastTestsDir = deps.paths.join(devJourneyDir, "past-tests");
	writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.md`, archivedContent, deps, "JourneyReport archived");
	writeReport(pastTestsDir, `${safeTs}-${title}${archiveSuffix}.canvas`, JSON.stringify(devCanvas, null, "\t"), deps, "JourneyCanvas archived");

	copyScreenshots(deps.paths.join(dir, "screenshots"), deps.paths.join(devJourneyDir, "screenshots"), deps);

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

// ── Reconciled Totals ───────────────────────────────────────────

const EMPTY_COUNTS = { totalPassed: 0, totalFailed: 0, totalSkipped: 0, totalDev: 0, totalTests: 0 } as const;

function extractReconciledCounts(reconciled: ReturnType<typeof reconcileResults>): { totalPassed: number; totalFailed: number; totalSkipped: number; totalDev: number; totalTests: number } {
	if (!reconciled) return { ...EMPTY_COUNTS };
	const { totalPassed, totalFailed, totalSkipped, totalDev = 0, totalTests } = reconciled;
	return { totalPassed, totalFailed, totalSkipped, totalDev, totalTests };
}

export function computeReconciledTotals(vitest: VitestResults | null, journeys: JourneyEntry[], deps: Pick<CliDeps, "proc">): ReconciledTotals {
	const counts = extractReconciledCounts(reconcileResults(vitest, journeys));
	const effectiveSkipped = counts.totalSkipped + counts.totalDev + (resolveMode(deps) !== "full" ? 1 : 0);
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
	e2e: E2EPaths, deps: E2ESummaryDeps,
): void {
	doc.addBlank().heading(1, `E2E Report${totals.overallStatus === "partial-pass" ? " (Partial)" : ""}`).addBlank();
	doc.callout(statusCallout(totals.overallStatus), `Summary — ${statusLabel(totals.overallStatus)}`, [
		`Mode: **${resolveMode(deps)}** | Tests: ${totals.totalTests} | Passed: ${totals.totalPassed} | Failed: ${totals.totalFailed} | Skipped: ${totals.totalSkipped}` + (totals.totalDev > 0 ? ` | Dev: ${totals.totalDev}` : ""),
		`Duration: ${formatDuration(totals.totalDurationMs)}`,
	]);
	doc.addBlank();

	renderFailuresSection(doc, collectFailedSteps(journeyReportNames), collectVitestFailures(vitest));
	renderWarningsSection(doc, journeyReportNames);
	renderActionCoverageSection(doc, aggregate, allTools, journeys.length, journeyReportNames, perJourneyStats);

	if (vitest && vitest.suites.length > 0) {
		doc.addSeparator().addBlank();
		doc.heading(2, "Units Under Test").addBlank();
		doc.list(vitest.suites.map((s) => `\`${deps.paths.relative(e2e.projectRoot, s.file).replace(/\\/g, "/")}\``));
		doc.addBlank();
	}

	const reconciled = reconcileResults(vitest, journeys);
	if (reconciled) renderTestSuitesSection(doc, reconciled, journeyReportNames);

	buildPerfLines(startupPerf, doc);
	buildEventTraceLines(trace, doc);
	renderJourneysSummarySection(doc, journeyReportNames, perJourneyStats);
}

// ── Output Writing ──────────────────────────────────────────────

function writeE2EOutputs(content: string, now: Date, overallStatus: string, e2e: E2EPaths, deps: IODeps): void {
	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const e2eFilename = `${safeTimestamp}-e2e-report${overallStatus === "partial-pass" ? " (Partial)" : ""}.md`;
	writeReport(e2e.testVault, "E2E Report.md", content, deps, "E2EReport written");
	writeReport(deps.paths.join(e2e.projectRoot, "docs", "reports", "e2e"), "E2E Report.md", content, deps, "E2EReport current");
	writeReport(e2e.devRunsDir, e2eFilename, content, deps, "E2EReport archived");
}

/** Cleans up temporary result files after report generation. */
export function cleanupResults(journeys: JourneyEntry[], vitestResultsPath: string, deps: IODeps): void {
	try { if (deps.disk.existsSync(vitestResultsPath)) deps.disk.rmSync(vitestResultsPath, { force: true }); } catch { /* ignore */ }
	for (const { dir, data } of journeys) {
		try { deps.disk.rmSync(deps.paths.join(dir, `${(data.journey as string)}-results.json`), { force: true }); } catch { /* ignore */ }
	}
}

function generateJourneyReports(
	journeys: JourneyEntry[], date: string, now: Date, trace: TraceData | null, e2e: E2EPaths, deps: E2ESummaryDeps,
): Array<{ title: string; data: Record<string, unknown> }> {
	const journeyReportNames: Array<{ title: string; data: Record<string, unknown> }> = [];
	for (const { dir, data } of journeys) {
		const result = writeJourneyOutputs(dir, data, date, now, trace, e2e, deps);
		journeyReportNames.push({ title: result.title, data });
	}
	return journeyReportNames;
}

// ── Main Entry Point ────────────────────────────────────────────

export function generateE2EReport(e2e: E2EPaths, deps: E2ESummaryDeps): void {
	const vitestResultsPath = e2e.vitestResults;
	const journeysDir = deps.paths.join(e2e.testVault, "docs", "journeys");

	const vitest = readVitestResults(vitestResultsPath, deps);
	const journeys = readJourneyResults(journeysDir, deps);

	if (!vitest && journeys.length === 0) {
		return;
	}

	const now = deps.clock.now();
	const date = now.toISOString();
	const startupPerf = readStartupPerf(e2e.dataJsonCandidates, deps);
	const trace = readLatestEventTrace(e2e.devTracesDir, deps);

	const journeyReportNames = generateJourneyReports(journeys, date, now, trace, e2e, deps);
	const totals = computeReconciledTotals(vitest, journeys, deps);
	const { aggregate, perJourney: perJourneyStats } = aggregateJourneyStats(journeys);
	const allTools = aggregate.tools;

	const doc = Document.create("E2E Report");
	const testSuiteLinks = (vitest?.suites ?? []).map((s) => `[[${deps.paths.relative(e2e.projectRoot, s.file).replace(/\\/g, "/")}]]`);

	buildE2EFrontmatter(doc, {
		date, ...totals, aggregate, allTools, testSuiteLinks,
		journeyReportLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCanvasLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCount: journeys.length, trace, startupPerf,
	}, deps);

	renderE2EDocBody(doc, totals, vitest, journeys, journeyReportNames, aggregate, allTools, perJourneyStats, startupPerf, trace, e2e, deps);
	writeE2EOutputs(doc.toString(), now, totals.overallStatus, e2e, deps);
	cleanupResults(journeys, vitestResultsPath, deps);
}
