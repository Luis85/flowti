/**
 * generate-e2e-report.ts
 *
 * Generates E2E reports from test results:
 *   1. A top-level E2E Report with test suite results and journey summaries
 *   2. A dedicated Journey Report per journey with step-level detail + screenshots
 *
 * All outputs are written to both the test vault and the development vault.
 *
 * Usage: node scripts/generate-e2e-report.ts
 *
 * Input:
 *   docs/reports/e2e/e2e-results.json                        (vitest JSON, temp)
 *   <test-vault>/docs/journeys/<name>/<name>-results.json              (journey details)
 *
 * Output (test vault):
 *   <test-vault>/E2E Report.md                                                    (E2E summary, stable name)
 *   <test-vault>/docs/journeys/<name>/<name>.md                                   (journey report)
 *   <test-vault>/docs/journeys/<name>/screenshots/                                (journey screenshots)
 *
 * Output (dev vault mirror):
 *   docs/reports/e2e/runs/<timestamp>-e2e-report.md                     (E2E summary)
 *   docs/journeys/<name>/<name>.md                                      (journey report)
 *   docs/journeys/<name>/screenshots/                                   (journey screenshots)
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";
import { proc } from "../../../infrastructure/proc.js";
import { resolveE2EPaths, type E2EPaths } from "../../review/e2e-paths.js";
import { readProjectConfig } from "../../project/project-config.js";

// ── Lazy E2E path resolution ────────────────────────────────────────

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

function VITEST_RESULTS(): string { return e2e().vitestResults; }
function TEST_VAULT(): string { return e2e().testVault; }
function JOURNEYS_DIR(): string { return paths.join(e2e().testVault, "docs", "journeys"); }
function DEV_RUNS_DIR(): string { return e2e().devRunsDir; }
function DEV_TRACES_DIR(): string { return e2e().devTracesDir; }
function DEV_JOURNEYS_DIR(): string { return e2e().devJourneysDir; }
function DATA_JSON_CANDIDATES(): string[] { return e2e().dataJsonCandidates; }

// ── Interfaces ──────────────────────────────────────────────────────

interface VitestCase {
	name: string;
	status: string;
	durationMs: number;
	error: string | null;
	reconciledStatus?: string;
}

interface VitestSuite {
	name: string;
	file: string;
	cases: VitestCase[];
	hookError: string | null;
	suiteHookFailed: boolean;
	passed: number;
	failed: number;
	skipped: number;
	reconciledPassed?: number;
	reconciledFailed?: number;
	reconciledSkipped?: number;
	reconciledDev?: number;
}

interface VitestResults {
	totalPassed: number;
	totalFailed: number;
	totalSkipped: number;
	totalTests: number;
	totalDev?: number;
	durationMs: number;
	suites: VitestSuite[];
}

interface ActionStatsReturn {
	total: number;
	screenshots: number;
	assertions: number;
	manual_checks: number;
	manual_passed: number;
	manual_failed: number;
	visual_inspections: number;
	notices: number;
	theme_changes: number;
	create_files: number;
	delete_files: number;
	open_files: number;
	close_leaves: number;
	tools: string[];
}

interface JourneyEntry {
	dir: string;
	data: Record<string, unknown>;
}

interface JourneyReportResult {
	title: string;
	status: string;
	content: string;
}

interface StartupPerf {
	history: number[];
	sizeBytes: number;
}

interface TraceSummary {
	totalEvents?: number;
	perfEvents?: number;
	uniqueTypes?: number;
	eventFrequency?: Record<string, number>;
}

interface TraceData {
	summary?: TraceSummary;
	durationMs?: number;
	perfEvents?: PerfTraceEvent[];
}

interface PerfTraceEvent {
	type: string;
	payload: string | Record<string, unknown>;
}

interface CanvasNode {
	id: string;
	type: string;
	text?: string;
	file?: string;
	label?: string;
	styleAttributes?: Record<string, string>;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
	background?: string;
	backgroundStyle?: string;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: string;
	toNode: string;
	toSide: string;
}

interface CanvasResult {
	metadata: {
		version: string;
		frontmatter: Record<string, unknown>;
		startNode: string;
	};
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

interface StepAction {
	tool: string;
	id?: string;
	selector?: string;
	value?: string;
	style?: string;
	ms?: number;
	label?: string;
	hub?: string;
	tab?: string;
	type?: string;
	event?: string;
	viewType?: string;
	store?: string;
	message?: string;
	instruction?: string;
	prompt?: string;
	theme?: string;
	path?: string;
	duration?: number;
	description?: string;
}

interface StepDefinition {
	id: string;
	guideSection: string;
	title: string;
	description?: string;
	expectedInput?: string;
	expectedOutput?: string;
	phase?: string;
	actions?: StepAction[];
	describeBlock?: string;
	itBlock?: string;
	uiContext?: {
		view?: string;
		viewName?: string;
		tab?: string;
		tabName?: string;
		components?: string[];
	};
	events?: string[];
	commands?: string[];
	queries?: string[];
	interactions?: string[];
	improvements?: Array<{
		title: string;
		description?: string;
		priority?: string;
	}>;
}

interface ManualVerification {
	status: string;
	instruction: string;
	notes?: string;
}

interface DomSnapshot {
	activeViewType: string;
	leafCount: number;
	hasModal: boolean;
	notices?: string[];
	visibleElements?: string[];
}

interface RecentEvent {
	type: string;
	relativeMs: number;
}

interface PluginState {
	loaded: boolean;
	serviceCount: number;
}

interface ErrorContext {
	domSnapshot?: DomSnapshot;
	recentEvents?: RecentEvent[];
	consoleErrors?: string[];
	availableVariables?: string[];
	pluginState?: PluginState;
}

interface StepResult {
	step: StepDefinition;
	status: string;
	durationMs: number;
	error?: string;
	errorContext?: ErrorContext;
	warnings?: string[];
	screenshotFiles?: string[];
	screenshotFile?: string;
	manualVerifications?: ManualVerification[];
}

interface StartupService {
	service: string;
	durationMs: number;
}

interface StartupTotal {
	durationMs: number;
	serviceCount: number;
}

interface StorageOp {
	key: string;
	op: string;
	durationMs: number;
	sizeBytes: number;
}

interface QueryOp {
	queryId: string;
	durationMs: number;
	sourceRows: number;
	resultRows: number;
}

interface DispatchOp {
	eventType: string;
	handlerCount: number;
	durationMs: number;
}

interface AlertOp {
	metric: string;
	value: number;
	threshold: number;
}

interface DispatchAggregate {
	count: number;
	totalMs: number;
	maxMs: number;
}

/**
 * Resolves the E2E execution mode label from the E2E_JOURNEY env var.
 * Supports comma-separated journey names for multi-journey runs.
 *
 * Examples:
 *   (not set)                        → "full"
 *   "installer"                      → "installer"
 *   "getting-started"                → "getting-started"
 *   "getting-started,component-library" → "getting-started,component-library"
 *   "installer,getting-started"      → "installer,getting-started"
 */
function resolveMode(): string {
	const journey = proc.env().E2E_JOURNEY;
	if (!journey) return "full";
	return journey;
}

/**
 * Resolves {{key}} template variables in a string using a variables map.
 * Returns the original string if no variables map is provided.
 */
function resolveVars(template: string, variables?: Record<string, string>): string {
	if (!template) return "";
	return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string): string => {
		if (variables && key in variables) return variables[key];
		return "\u2014"; // unresolved variable (step was skipped or variable not set)
	});
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const totalSec = ms / 1000;
	if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
	const min = Math.floor(totalSec / 60);
	const sec = Math.round(totalSec % 60);
	return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

/**
 * Returns the callout type for a given status.
 *   - "pass"         → "success"
 *   - "fail"         → "danger"
 *   - "skipped"      → "warning"
 *   - "partial-pass" → "warning"
 *   - "dev"          → "info"
 *   - "dev-stopped"  → "info"
 */
function statusCallout(status: string): string {
	if (status === "partial-pass") return "warning";
	if (status === "skipped") return "warning";
	if (status === "dev" || status === "dev-stopped") return "info";
	return status === "pass" ? "success" : "danger";
}

/**
 * Determines a suite/journey result status.
 *   - "pass"         — at least one test passed, none failed, none skipped, no warnings
 *   - "partial-pass" — at least one test passed, none failed, but skipped or warned
 *   - "fail"         — one or more tests failed
 *   - "dev-stopped"  — journey terminated at a dev boundary (no real failures)
 *   - "skipped"      — zero tests ran (upstream failure caused skip)
 */
function resolveStatus(passed: number, failed: number, total: number, skipped: number = 0, hasWarnings: boolean = false, devStopped: boolean = false): string {
	if (devStopped) return "dev-stopped";
	if (failed > 0) return "fail";
	if (passed > 0) return (skipped > 0 || hasWarnings) ? "partial-pass" : "pass";
	return "skipped";
}

function statusLabel(status: string): string {
	if (status === "partial-pass") return "PARTIAL PASS";
	if (status === "skipped") return "SKIPPED";
	if (status === "dev-stopped") return "DEV";
	if (status === "dev") return "DEV";
	return status === "pass" ? "PASS" : "FAIL";
}

/**
 * Computes action statistics from journey result data.
 * Aggregates counts per tool type across all steps.
 */
/** Maps tool names to their corresponding counter key in ActionStatsReturn. */
const TOOL_COUNTER_MAP: Record<string, keyof Omit<ActionStatsReturn, "total" | "tools" | "manual_passed" | "manual_failed">> = {
	"screenshot": "screenshots",
	"assert": "assertions",
	"manual": "manual_checks",
	"visual-inspection": "visual_inspections",
	"notice": "notices",
	"theme": "theme_changes",
	"create-file": "create_files",
	"delete-file": "delete_files",
	"open-file": "open_files",
	"close-leaves": "close_leaves",
};

function computeActionStats(data: Record<string, unknown>): ActionStatsReturn {
	const result: ActionStatsReturn = {
		total: 0, screenshots: 0, assertions: 0,
		manual_checks: 0, manual_passed: 0, manual_failed: 0,
		visual_inspections: 0, notices: 0, theme_changes: 0,
		create_files: 0, delete_files: 0, open_files: 0, close_leaves: 0,
		tools: [],
	};
	const toolSet = new Set<string>();

	for (const stepResult of (data.steps as StepResult[] ?? [])) {
		for (const action of stepResult.step?.actions ?? []) {
			result.total++;
			toolSet.add(action.tool);
			const key = TOOL_COUNTER_MAP[action.tool];
			if (key) (result[key] as number)++;
		}
		for (const mv of stepResult.manualVerifications ?? []) {
			if (mv.status === "pass") result.manual_passed++;
			else result.manual_failed++;
		}
	}

	result.tools = [...toolSet].sort();
	return result;
}

/** Parses a single vitest assertion result into a VitestCase. */
function parseVitestCase(test: Record<string, unknown>): VitestCase {
	return {
		name: (test.fullName as string) ?? (test.ancestorTitles as string[] | undefined)?.join(" > ") ?? "unknown",
		status: (test.status as string) ?? "unknown",
		durationMs: (test.duration as number) ?? 0,
		error: (test.failureMessages as string[] | undefined)?.join("\n") ?? null,
	};
}

/** Extracts the hook error message from a vitest file result. */
function extractHookError(file: Record<string, unknown>): string {
	return (file.message as string)
		|| ((file.assertionResults as Record<string, unknown>[] | undefined)
			?.find((t) => (t.failureMessages as string[] | undefined)?.length)
			?.failureMessages as string[] | undefined)?.[0]
		|| "Hook failed (no details available)";
}

/** Parses a single vitest file result into a VitestSuite and returns case-level totals. */
function parseVitestSuite(file: Record<string, unknown>): { suite: VitestSuite; passed: number; failed: number; skipped: number } {
	const suiteName = paths.basename(file.name as string, ".test.ts");
	const cases = (file.assertionResults as Record<string, unknown>[] ?? []).map(parseVitestCase);
	const suiteHookFailed = file.status === "failed";

	let passed = 0, failed = 0, skipped = 0;
	for (const c of cases) {
		if (c.status === "passed") passed++;
		else if (c.status === "failed") failed++;
		else skipped++;
	}

	const caseFailed = cases.filter((c) => c.status === "failed").length;
	if (suiteHookFailed && caseFailed === 0) failed++;

	const hookError = suiteHookFailed ? extractHookError(file) : null;

	return {
		suite: {
			name: suiteName,
			file: file.name as string,
			cases,
			hookError,
			suiteHookFailed,
			passed: cases.filter((c) => c.status === "passed").length,
			failed: caseFailed + (suiteHookFailed && caseFailed === 0 ? 1 : 0),
			skipped: cases.filter((c) => c.status !== "passed" && c.status !== "failed").length,
		},
		passed,
		failed,
		skipped,
	};
}

/** Reads vitest JSON reporter output and extracts test suite/case results. */
function readVitestResults(): VitestResults | null {
	if (!disk.existsSync(VITEST_RESULTS())) return null;

	const raw = JSON.parse(disk.readFileSync(VITEST_RESULTS(), "utf-8")) as Record<string, unknown>;
	const files = raw.testResults as Record<string, unknown>[] ?? [];

	let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
	const suites: VitestSuite[] = [];

	for (const file of files) {
		const { suite, passed, failed, skipped } = parseVitestSuite(file);
		suites.push(suite);
		totalPassed += passed;
		totalFailed += failed;
		totalSkipped += skipped;
	}

	return {
		totalPassed,
		totalFailed,
		totalSkipped,
		totalTests: totalPassed + totalFailed + totalSkipped,
		durationMs: (raw.startTime as number) ? clock.ms() - (raw.startTime as number) : 0,
		suites,
	};
}

/** Reads all journey results from the test vault journeys directory. */
function readJourneyResults(): JourneyEntry[] {
	if (!disk.existsSync(JOURNEYS_DIR())) return [];

	const journeys: JourneyEntry[] = [];
	const entries = disk.readdirSync(JOURNEYS_DIR(), { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const journeyDir = paths.join(JOURNEYS_DIR(), entry.name);
		const resultsFile = paths.join(journeyDir, `${entry.name}-results.json`);

		if (disk.existsSync(resultsFile)) {
			journeys.push({
				dir: journeyDir,
				data: JSON.parse(disk.readFileSync(resultsFile, "utf-8")) as Record<string, unknown>,
			});
		}
	}

	return journeys;
}

/**
 * Reconciles vitest suite/case data with journey runner results.
 *
 * Vitest doesn't know about journey-level skipping or dev boundaries — it sees
 * all early-returning it() blocks as "passed". The journey runner has the real
 * step statuses (pass, fail, skip, dev). This function overlays journey data
 * onto matching vitest cases so downstream report sections use correct numbers.
 *
 * For each vitest suite, we look for a matching journey (by name). For each
 * vitest case in that suite, we match it to a journey step by checking if the
 * case name contains the step's itBlock. Matched cases get their status overridden.
 *
 * Returns updated vitest data with reconciled totals.
 */
/** Maps a journey runner step status to the reconciled vitest status string. */
const JOURNEY_STATUS_MAP: Record<string, string> = {
	skip: "skipped",
	dev: "dev",
	fail: "failed",
	pass: "passed",
};

/** Builds the journey name → step statuses lookup from journey entries. */
function buildJourneyStepMap(journeys: JourneyEntry[]): Map<string, Array<{ itBlock: string; status: string }>> {
	const map = new Map<string, Array<{ itBlock: string; status: string }>>();
	for (const { data } of journeys) {
		const name = data.journey as string;
		const steps = ((data.steps as StepResult[] ?? []) as StepResult[]).map((r) => ({
			itBlock: r.step?.itBlock ?? `${r.step?.guideSection} — ${r.step?.title}`,
			status: r.status,
		}));
		map.set(name, steps);
	}
	return map;
}

/** Finds a matching journey for a suite by slug comparison. */
function findMatchingJourney(
	suiteName: string,
	journeyStepMap: Map<string, Array<{ itBlock: string; status: string }>>,
): Array<{ itBlock: string; status: string }> | null {
	for (const [name, steps] of journeyStepMap) {
		const slug = name.toLowerCase().replace(/\s+/g, "-");
		if (suiteName.includes(slug)) return steps;
	}
	return null;
}

/** Reconciles a single case against journey step data and returns the status category. */
function reconcileCase(c: VitestCase, journeySteps: Array<{ itBlock: string; status: string }>): "passed" | "failed" | "skipped" | "dev" {
	const matchedStep = journeySteps.find((s) => c.name.includes(s.itBlock));
	if (matchedStep) {
		c.reconciledStatus = JOURNEY_STATUS_MAP[matchedStep.status] ?? "passed";
	} else {
		c.reconciledStatus = c.status;
	}
	if (c.reconciledStatus === "dev") return "dev";
	if (c.reconciledStatus === "passed") return "passed";
	if (c.reconciledStatus === "failed") return "failed";
	return "skipped";
}

function reconcileResults(vitest: VitestResults | null, journeys: JourneyEntry[]): VitestResults | null {
	if (!vitest || journeys.length === 0) return vitest;

	const journeyStepMap = buildJourneyStepMap(journeys);
	let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalDev = 0;

	for (const suite of vitest.suites) {
		const journeySteps = findMatchingJourney(suite.name, journeyStepMap);
		if (!journeySteps) {
			totalPassed += suite.passed;
			totalFailed += suite.failed;
			totalSkipped += suite.skipped;
			continue;
		}

		let suitePassed = 0, suiteFailed = 0, suiteSkipped = 0, suiteDev = 0;
		for (const c of suite.cases) {
			const category = reconcileCase(c, journeySteps);
			if (category === "passed") suitePassed++;
			else if (category === "failed") suiteFailed++;
			else if (category === "dev") suiteDev++;
			else suiteSkipped++;
		}

		suite.reconciledPassed = suitePassed;
		suite.reconciledFailed = suiteFailed;
		suite.reconciledSkipped = suiteSkipped;
		suite.reconciledDev = suiteDev;

		totalPassed += suitePassed;
		totalFailed += suiteFailed;
		totalSkipped += suiteSkipped;
		totalDev += suiteDev;
	}

	return { ...vitest, totalPassed, totalFailed, totalSkipped, totalDev, totalTests: totalPassed + totalFailed + totalSkipped + totalDev };
}

function setJourneyActionFrontmatter(doc: InstanceType<typeof Document>, stats: ActionStatsReturn): void {
	doc.mergeFrontmatter({
		total_actions: stats.total, screenshots: stats.screenshots,
		assertions: stats.assertions, manual_checks: stats.manual_checks,
	});
	if (stats.manual_passed > 0) doc.setFrontmatter("manual_passed", stats.manual_passed);
	if (stats.manual_failed > 0) doc.setFrontmatter("manual_failed", stats.manual_failed);
	doc.mergeFrontmatter({
		visual_inspections: stats.visual_inspections, notices: stats.notices,
		theme_changes: stats.theme_changes, create_files: stats.create_files,
		delete_files: stats.delete_files, open_files: stats.open_files, close_leaves: stats.close_leaves,
	});
	if (stats.tools.length > 0) doc.setFrontmatter("tools", stats.tools);
	else doc.setRawFrontmatter("tools", "[]");
}

function resolveJourneyTags(status: string): string[] {
	const tags = ["report", "e2e", "journey"];
	if (status === "partial-pass") tags.push("partial");
	else if (status === "dev-stopped") tags.push("dev");
	return tags;
}

/** Builds the journey report frontmatter onto the document. */
function buildJourneyFrontmatter(
	doc: InstanceType<typeof Document>,
	opts: { journeySlug: string; journeyTitle: string; journeyStatus: string; date: string; totalSteps: number; passedSteps: number; failedSteps: number; skippedSteps: number; devSteps: number; isDevStopped: boolean; actionStats: ActionStatsReturn; durationMs: number; testSource?: string },
): void {
	doc.mergeFrontmatter({
		type: "JourneyReport", mode: resolveMode(), journey: opts.journeySlug, date: opts.date,
		total_steps: opts.totalSteps, passed: opts.passedSteps, failed: opts.failedSteps, skipped: opts.skippedSteps,
	});
	if (opts.devSteps > 0) doc.setFrontmatter("dev", opts.devSteps);
	if (opts.isDevStopped) doc.setFrontmatter("dev_stopped", true);
	setJourneyActionFrontmatter(doc, opts.actionStats);
	doc.mergeFrontmatter({
		duration_ms: opts.durationMs, duration: formatDuration(opts.durationMs),
		success: opts.journeyStatus === "pass" || opts.journeyStatus === "partial-pass" || opts.journeyStatus === "dev-stopped",
		status: opts.journeyStatus,
	});
	if (opts.testSource) doc.setRawFrontmatter("test_source", `"[[${opts.testSource}]]"`);
	doc.setRawFrontmatter("e2e_report", '"[[E2E Report]]"');
	doc.setRawFrontmatter("canvas", `"[[${opts.journeyTitle}]]"`);
	doc.setTags(resolveJourneyTags(opts.journeyStatus));
}

function appendDomSnapshotLines(lines: string[], ctx: ErrorContext): void {
	if (!ctx.domSnapshot) return;
	const ds = ctx.domSnapshot;
	lines.push(`**Active view**: \`${ds.activeViewType}\` | Leaves: ${ds.leafCount} | Modal: ${ds.hasModal ? "yes" : "no"}`);
	if (ds.notices && ds.notices.length > 0) {
		lines.push(`**Notices**: ${ds.notices.map((n) => `\`${n.substring(0, 80)}\``).join(", ")}`);
	}
	if (ds.visibleElements && ds.visibleElements.length > 0) {
		lines.push(`**Visible**: ${ds.visibleElements.join(", ")}`);
	}
}

function appendRecentEventsLines(lines: string[], ctx: ErrorContext): void {
	if (!ctx.recentEvents || ctx.recentEvents.length === 0) return;
	lines.push("", "**Recent Events** (last 10):");
	for (const e of ctx.recentEvents) lines.push(`- \`${e.type}\` (${e.relativeMs}ms ago)`);
}

function appendConsoleAndStateLines(lines: string[], ctx: ErrorContext): void {
	if (ctx.consoleErrors && ctx.consoleErrors.length > 0) {
		lines.push("", "**Console Errors**:");
		for (const e of ctx.consoleErrors) lines.push(`- \`${e.substring(0, 120)}\``);
	}
	if (ctx.availableVariables && ctx.availableVariables.length > 0) {
		lines.push("", `**Variables**: ${ctx.availableVariables.map((v) => `\`${v}\``).join(", ")}`);
	}
	if (ctx.pluginState) {
		lines.push("", `**Plugin**: loaded=${ctx.pluginState.loaded}, services=${ctx.pluginState.serviceCount}`);
	}
}

/** Builds error context callout lines from a step's ErrorContext. */
function buildErrorContextLines(ctx: ErrorContext): string[] {
	const lines: string[] = [];
	appendDomSnapshotLines(lines, ctx);
	appendRecentEventsLines(lines, ctx);
	appendConsoleAndStateLines(lines, ctx);
	return lines;
}

/** Renders manual QA actions/results into the document. */
function renderManualQA(doc: InstanceType<typeof Document>, stepResult: StepResult, vars: Record<string, string>): void {
	const manualActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "manual");
	const manualResults = stepResult.manualVerifications ?? [];
	if (manualResults.length > 0) {
		const allPassed = manualResults.every((m) => m.status === "pass");
		const mqLines: string[] = [];
		for (const m of manualResults) {
			mqLines.push(`- ${m.status === "pass" ? "\u2713" : "\u2717"} ${m.instruction}`);
			if (m.notes) mqLines.push(`  *Notes*: ${m.notes}`);
		}
		doc.callout(allPassed ? "success" : "failure", allPassed ? "Manual QA — PASSED" : "Manual QA — FAILED", mqLines);
		doc.addBlank();
	} else if (manualActions.length > 0) {
		doc.callout("todo", "Manual QA", manualActions.map((m) => `- [ ] ${resolveVars(m.instruction ?? "", vars)}`));
		doc.addBlank();
	}
}

function appendWarningReasons(viLines: string[], warnings: string[]): void {
	viLines.push("");
	for (const w of warnings) {
		const reasonMatch = w.match(/\nReason:\s*(.+)/);
		viLines.push(`**Reason**: ${reasonMatch ? reasonMatch[1].trim() : w}`);
	}
}

/** Renders visual inspection actions and step warnings into the document. */
function renderVisualAndWarnings(doc: InstanceType<typeof Document>, stepResult: StepResult, vars: Record<string, string>): void {
	const viActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "visual-inspection");
	const hasWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	if (viActions.length > 0) {
		const viLines = viActions.map((vi) => `- ${resolveVars(vi.prompt ?? "", vars)}`);
		if (hasWarnings) appendWarningReasons(viLines, stepResult.warnings!);
		doc.callout(hasWarnings ? "warning" : "eye", hasWarnings ? "Visual Inspection — FAILED" : "Visual Inspection", viLines);
		doc.addBlank();
	} else if (hasWarnings) {
		doc.callout("warning", "Warnings", stepResult.warnings!.map((w) => `- ${w}`));
		doc.addBlank();
	}
}

/** Maps a raw step status to a normalized status string. */
const RAW_STATUS_MAP: Record<string, string> = { dev: "dev", pass: "pass", fail: "fail" };

/** Maps a step status to its heading suffix tag. */
const STATUS_TAG_MAP: Record<string, string> = { fail: " FAIL", skipped: " [SKIP]", dev: " [DEV]" };

function resolveStepStatus(stepResult: StepResult): string {
	const rawStatus = RAW_STATUS_MAP[stepResult.status] ?? "skipped";
	const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	return (rawStatus === "pass" && hasStepWarnings) ? "partial-pass" : rawStatus;
}

function renderStepHeader(doc: InstanceType<typeof Document>, stepResult: StepResult, stepStatus: string): void {
	const s = stepResult.step;
	doc.heading(3, `Step ${s.guideSection}: ${s.title}${STATUS_TAG_MAP[stepStatus] ?? ""}`);
	doc.addBlank();

	const mainCalloutLines: string[] = [];
	if (stepResult.error) mainCalloutLines.push(`**Error**: ${stepResult.error}`);
	doc.callout(statusCallout(stepStatus), `${statusLabel(stepStatus)} (${formatDuration(stepResult.durationMs)})`, mainCalloutLines);

	if (stepResult.errorContext) {
		doc.addBlank();
		doc.callout("bug", "Error Context", buildErrorContextLines(stepResult.errorContext));
	}
	doc.addBlank();
}

function renderStepBody(doc: InstanceType<typeof Document>, s: StepDefinition): void {
	if (s.description) { doc.text(s.description); doc.addBlank(); }
	if (s.expectedInput || s.expectedOutput) {
		doc.text("| | |"); doc.text("|---|---|");
		if (s.expectedInput) doc.text(`| **Input** | ${s.expectedInput} |`);
		if (s.expectedOutput) doc.text(`| **Expected** | ${s.expectedOutput} |`);
		doc.addBlank();
	}
}

function renderStepScreenshots(doc: InstanceType<typeof Document>, stepResult: StepResult): void {
	const screenshots = stepResult.screenshotFiles ?? (stepResult.screenshotFile ? [stepResult.screenshotFile] : []);
	for (const file of screenshots) doc.text(`![[${file}]]`);
	if (screenshots.length > 0) doc.addBlank();
}

function renderStepNotices(doc: InstanceType<typeof Document>, actions: StepAction[], vars: Record<string, string>): void {
	const noticeActions = actions.filter((a) => a.tool === "notice");
	if (noticeActions.length === 0) return;
	doc.callout("quote", "Notices", noticeActions.map((n) => {
		const dur = n.duration ? ` (${n.duration}ms)` : "";
		return `- ${resolveVars(n.message ?? "", vars)}${dur}`;
	}));
	doc.addBlank();
}

/** Renders a single step result into the document. */
function renderStep(doc: InstanceType<typeof Document>, stepResult: StepResult, vars: Record<string, string>): void {
	renderStepHeader(doc, stepResult, resolveStepStatus(stepResult));
	renderStepBody(doc, stepResult.step);
	renderStepScreenshots(doc, stepResult);
	renderManualQA(doc, stepResult, vars);
	renderVisualAndWarnings(doc, stepResult, vars);
	renderStepNotices(doc, stepResult.step.actions ?? [], vars);
}

/** Renders a phase section (setup/teardown) with its steps. */
function renderPhaseSection(doc: InstanceType<typeof Document>, label: string, steps: StepResult[], vars: Record<string, string>): void {
	if (steps.length === 0) return;
	const passed = steps.filter((r) => r.status === "pass").length;
	doc.heading(2, `${label} (${passed}/${steps.length})`);
	doc.addBlank();
	for (const stepResult of steps) renderStep(doc, stepResult, vars);
	doc.addSeparator().addBlank();
}

/** Builds the steps summary string for the journey header. */
function buildStepsSummary(passedSteps: number, totalSteps: number, skippedSteps: number, devSteps: number, isDevStopped: boolean): string {
	if (isDevStopped) return `${passedSteps}/${totalSteps} steps (${devSteps} dev, ${skippedSteps} skipped)`;
	if (skippedSteps > 0) return `${passedSteps}/${totalSteps} steps (${skippedSteps} skipped)`;
	return `${passedSteps}/${totalSteps} steps`;
}

interface JourneyDataFields {
	journeySlug: string; journeyTitle: string; totalSteps: number; passedSteps: number;
	failedSteps: number; skippedSteps: number; devSteps: number; isDevStopped: boolean;
	durationMs: number; actionStats: ActionStatsReturn; journeyStatus: string;
}

function extractJourneyFields(data: Record<string, unknown>): JourneyDataFields {
	const journeySlug = (data.journey as string) ?? "unknown";
	const journeyTitle = journeySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
	const totalSteps = (data.totalSteps as number) ?? 0;
	const passedSteps = (data.passed as number) ?? 0;
	const failedSteps = (data.failed as number) ?? 0;
	const skippedSteps = (data.skipped as number) ?? 0;
	const devSteps = (data.dev as number) ?? 0;
	const hasWarnings = ((data.steps as StepResult[]) ?? []).some((r) => r.warnings && r.warnings.length > 0);
	const isDevStopped = (data.devStopped as boolean) === true;
	const journeyStatus = resolveStatus(passedSteps, failedSteps, totalSteps, skippedSteps, hasWarnings, isDevStopped);
	const actionStats = computeActionStats(data);
	const durationMs = (data.durationMs as number) ?? 0;
	return { journeySlug, journeyTitle, totalSteps, passedSteps, failedSteps, skippedSteps, devSteps, isDevStopped, durationMs, actionStats, journeyStatus };
}

function buildJourneyActionsSummaryLine(stats: ActionStatsReturn): string {
	return `Actions: ${stats.total} | Screenshots: ${stats.screenshots} | Assertions: ${stats.assertions} | Manual: ${stats.manual_checks}` +
		(stats.visual_inspections > 0 ? ` | Visual: ${stats.visual_inspections}` : "") +
		` | Notices: ${stats.notices}` +
		(stats.theme_changes > 0 ? ` | Themes: ${stats.theme_changes}` : "");
}

function renderJourneyDocBody(doc: InstanceType<typeof Document>, fields: JourneyDataFields, data: Record<string, unknown>): void {
	const titleSuffix = fields.journeyStatus === "partial-pass" ? " (Partial)" : fields.journeyStatus === "dev-stopped" ? " (Dev)" : "";
	const stepsSummary = buildStepsSummary(fields.passedSteps, fields.totalSteps, fields.skippedSteps, fields.devSteps, fields.isDevStopped);

	doc.addBlank().heading(1, `Journey: ${fields.journeyTitle}${titleSuffix}`).addBlank();
	doc.callout(statusCallout(fields.journeyStatus), `${statusLabel(fields.journeyStatus)} — ${stepsSummary} | ${formatDuration(fields.durationMs)}`, [
		`Mode: **${resolveMode()}** | Source: \`${(data.testSource as string) ?? "unknown"}\``,
		buildJourneyActionsSummaryLine(fields.actionStats),
		`Tools: ${fields.actionStats.tools.map((t) => `\`${t}\``).join(" ")}`,
	]);
	doc.addBlank().text(`Canvas: [[${fields.journeyTitle}.canvas|${fields.journeyTitle} Canvas]]`).addBlank().addSeparator().addBlank();

	const allSteps = (data.steps as StepResult[]) ?? [];
	const vars = (data.variables as Record<string, string>) ?? {};

	renderPhaseSection(doc, "Setup", allSteps.filter((r) => r.step?.phase === "setup"), vars);
	doc.heading(2, `Steps (${fields.passedSteps}/${fields.totalSteps})`);
	doc.addBlank();
	for (const sr of allSteps.filter((r) => !r.step?.phase || r.step.phase === "journey")) renderStep(doc, sr, vars);
	doc.addSeparator().addBlank();
	renderPhaseSection(doc, "Teardown", allSteps.filter((r) => r.step?.phase === "teardown"), vars);
}

/**
 * Generates a dedicated journey report with full step details and screenshots.
 * Returns the report filename (without path) for wikilink references.
 */
function generateJourneyReport(data: Record<string, unknown>, date: string): JourneyReportResult {
	const fields = extractJourneyFields(data);
	const doc = Document.create(`Journey: ${fields.journeyTitle}`);
	buildJourneyFrontmatter(doc, {
		...fields, actionStats: fields.actionStats, testSource: data.testSource as string | undefined, date,
	});
	renderJourneyDocBody(doc, fields, data);
	return { title: fields.journeyTitle, status: fields.journeyStatus, content: doc.toString() };
}

// ── Canvas Layout Constants ─────────────────────────────────────
const GROUP_WIDTH = 947;
const GROUP_HEIGHT = 600;
const GROUP_SPACING_X = 120;
const INNER_MARGIN_LEFT = 370; // offset from group left — leaves screenshot visible
const ACTION_WIDTH = 560;
const CANVAS_PREFIX = "e2e-";

// Circle nodes (Start, Events, End)
const CIRCLE_WIDTH = 280;
const CIRCLE_HEIGHT = 239;
const START_X = -460;
const FIRST_GROUP_X = 170; // absolute x of first group

// Action node (inside groups, bottom section)
const ACTION_MARGIN_BOTTOM = 28;

// Result badge (inside groups, top-right — shows it() checklist item + metadata)

// Action groups (vertical stack below step groups)
const ACTION_GROUP_WIDTH = 400;
const ACTION_GROUP_HEIGHT_SCREENSHOT = 300;
const ACTION_GROUP_HEIGHT_DEFAULT = 100;
const ACTION_GROUP_GAP_Y = 3 * ACTION_GROUP_HEIGHT_DEFAULT;         // 3× node height between actions
const ACTION_GROUP_START_Y = GROUP_HEIGHT + 4 * ACTION_GROUP_HEIGHT_DEFAULT; // 4× node height from step to first action

// Events summary
const EVENTS_SIZE = 420;

// Improvement card dimensions (yellow cards stacked above step groups)
const IMPROVEMENT_WIDTH = ACTION_GROUP_WIDTH * 2;                    // 2× normal node width
const IMPROVEMENT_HEIGHT = ACTION_GROUP_HEIGHT_DEFAULT * 3;          // 3× normal node height
const IMPROVEMENT_GAP = ACTION_GROUP_HEIGHT_DEFAULT * 2;             // 2× node height spacing between cards

/**
 * Returns a color code for an action tool type on the canvas.
 *   - screenshot → 6 (cyan)
 *   - assert → 4 (green)
 *   - manual → 3 (yellow)
 *   - notice → 5 (purple)
 *   - emit → 1 (red)
 *   - theme → 2 (orange)
 *   - lifecycle tools → 0 (gray)
 *   - others → undefined (default)
 */
const ACTION_COLOR_MAP: Record<string, string> = {
	"screenshot": "6",
	"assert": "4",
	"manual": "3",
	"visual-inspection": "3",
	"notice": "5",
	"emit": "1",
	"theme": "2",
	"create-file": "0",
	"delete-file": "0",
	"open-file": "0",
	"close-leaves": "0",
};

function actionColor(tool: string): string | undefined {
	return ACTION_COLOR_MAP[tool];
}

/** Formats an assert action based on its type subfield. */
function formatAssertText(action: StepAction, r: (s: string) => string, desc: string): string {
	if (action.type === "visible" || action.type === "not-visible" || action.type === "text") {
		return `**assert ${action.type}** \`${action.selector}\`${desc}`;
	}
	if (action.type === "event") return `**assert event** \`${r(action.event ?? "")}\`${desc}`;
	if (action.type === "leaf") return `**assert leaf** \`${r(action.viewType ?? "")}\`${desc}`;
	return `**assert ${action.type}**${desc}`;
}

type ActionFormatter = (action: StepAction, r: (s: string) => string, desc: string) => string;

const ACTION_FORMAT_MAP: Record<string, ActionFormatter> = {
	"command": (a, r, d) => `**command** \`${r(a.id ?? "")}\`${d}`,
	"click": (a, _r, d) => `**click** \`${a.selector}\`${d}`,
	"input": (a, r, d) => `**input** \`${a.selector}\`\n→ "${r(a.value ?? "")}"${d}`,
	"highlight": (a, _r, d) => `**highlight** \`${a.selector}\` [${a.style ?? "element"}]${d}`,
	"wait": (a) => `**wait** ${a.ms}ms`,
	"screenshot": (a, _r, d) => `**screenshot** ${a.label ?? "(auto)"}${d}`,
	"navigate": (a, r, d) => `**navigate** ${r(a.hub ?? "")} → ${r(a.tab ?? "")}${d}`,
	"assert": formatAssertText,
	"emit": (a, r, d) => `**emit** \`${r(a.event ?? "")}\`${d}`,
	"eval": (a, _r, d) => `**eval**${a.store ? ` → \`${a.store}\`` : ""}${d}`,
	"notice": (a, r, d) => `**notice** ${r(a.message ?? "")}${d}`,
	"manual": (a, r) => `**manual**\n${r(a.instruction ?? "")}`,
	"visual-inspection": (a, r) => `**visual-inspection**\n${r(a.prompt ?? "")}`,
	"theme": (a, r, d) => `**theme** → \`${r(a.theme ?? "")}\`${d}`,
	"create-file": (a, r, d) => `**create-file** \`${r(a.path ?? "")}\`${d}`,
	"delete-file": (a, r, d) => `**delete-file** \`${r(a.path ?? "")}\`${d}`,
	"open-file": (a, r, d) => `**open-file** \`${r(a.path ?? "")}\`${d}`,
	"close-leaves": (a, r, d) => `**close-leaves** \`${r(a.viewType ?? "")}\`${d}`,
};

/**
 * Formats a single action into a concise text label for canvas rendering.
 */
function formatActionText(action: StepAction, vars?: Record<string, string>): string {
	const desc = action.description ? `\n${action.description}` : "";
	const r = (s: string): string => resolveVars(s, vars);
	const formatter = ACTION_FORMAT_MAP[action.tool];
	return formatter ? formatter(action, r, desc) : `**${action.tool}**${desc}`;
}

// ── Canvas ID helpers ──
function nId(key: string): string { return `${CANVAS_PREFIX}n-${key}`; }
function gId(key: string): string { return `${CANVAS_PREFIX}g-${key}`; }
function eId(from: string, to: string): string { return `${CANVAS_PREFIX}e-${from}-${to}`; }

/** Strips canvas prefix from a node ID for edge naming. */
function stripPrefix(id: string): string {
	return id.replace(`${CANVAS_PREFIX}n-`, "").replace(`${CANVAS_PREFIX}g-`, "");
}

/** Maps a status to a canvas color code. */
const CANVAS_STATUS_COLOR: Record<string, string> = { pass: "4", "partial-pass": "5", fail: "1" };

/** Maps a status to a canvas checkbox mark. */
const CANVAS_CHECKBOX_MAP: Record<string, string> = { pass: "[x]", fail: "[!]" };
function canvasCheckbox(status: string, hasWarnings: boolean): string {
	if (status === "pass" && hasWarnings) return "[~]";
	return CANVAS_CHECKBOX_MAP[status] ?? "[ ]";
}

function appendConfigDescriptionLines(lines: string[], s: StepDefinition): void {
	if (s.description) { lines.push(s.description); lines.push(""); }
	if (s.expectedInput) lines.push(`**Input**: ${s.expectedInput}`);
	if (s.expectedOutput) lines.push(`**Expected**: ${s.expectedOutput}`);
	if (s.expectedInput || s.expectedOutput) lines.push("");
}

function appendConfigUiContextLines(lines: string[], s: StepDefinition): void {
	const ui = s.uiContext;
	if (ui?.viewName) lines.push(`**View**: ${ui.viewName} (\`${ui.view}\`)`);
	if (ui?.tabName) lines.push(`**Tab**: ${ui.tabName} (\`${ui.tab}\`)`);
	if (ui?.components?.length) lines.push(`**Components**: ${ui.components.map((c) => `\`${c}\``).join(" ")}`);
}

function appendConfigMetadataLines(lines: string[], s: StepDefinition): void {
	if (s.events?.length) lines.push(`**Events**: ${s.events.map((e) => `\`${e}\``).join(" ")}`);
	if (s.commands?.length) lines.push(`**Commands**: ${s.commands.map((c) => `\`${c}\``).join(" ")}`);
	if (s.queries?.length) lines.push(`**Queries**: ${s.queries.map((q) => `\`${q}\``).join(" ")}`);
	if (s.interactions?.length) lines.push(`**Interactions**: ${s.interactions.map((i) => `*${i}*`).join(", ")}`);
}

/** Builds the config card text lines for a step on the canvas. */
function buildCanvasConfigLines(
	stepResult: StepResult, journeySlug: string, canvasVars: Record<string, string>,
): string[] {
	const s = stepResult.step;
	const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	const cb = canvasCheckbox(stepResult.status, !!hasStepWarnings);
	const durationStr = stepResult.durationMs ? formatDuration(stepResult.durationMs) : "";

	const lines: string[] = [];
	lines.push(`**describe** ${s.describeBlock ?? journeySlug ?? ""}`);
	lines.push(`- ${cb} **it** ${s.itBlock ?? `${s.guideSection} — ${s.title}`} (${durationStr})`);
	lines.push("");

	appendConfigDescriptionLines(lines, s);
	appendConfigUiContextLines(lines, s);
	appendConfigMetadataLines(lines, s);
	appendCanvasManualLines(lines, stepResult, canvasVars);
	appendCanvasVisualLines(lines, stepResult, canvasVars);

	const noticeActions = (s.actions ?? []).filter((a) => a.tool === "notice");
	if (noticeActions.length > 0) {
		lines.push("", `**Notices**: ${noticeActions.map((n) => `*${resolveVars(n.message ?? "", canvasVars)}*`).join(", ")}`);
	}
	if (stepResult.error) { lines.push("", `**Error**: ${stepResult.error}`); }

	return lines;
}

function appendManualResultLines(lines: string[], manualResults: ManualVerification[]): void {
	const allPassed = manualResults.every((m) => m.status === "pass");
	lines.push("", allPassed ? "**Manual QA — PASSED**:" : "**Manual QA — FAILED**:");
	for (const m of manualResults) {
		lines.push(`- ${m.status === "pass" ? "\u2713" : "\u2717"} ${m.instruction}`);
		if (m.notes) lines.push(`  *Notes*: ${m.notes}`);
	}
}

/** Appends manual QA lines for canvas config cards. */
function appendCanvasManualLines(lines: string[], stepResult: StepResult, vars: Record<string, string>): void {
	const manualActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "manual");
	const manualResults = stepResult.manualVerifications ?? [];
	if (manualResults.length > 0) {
		appendManualResultLines(lines, manualResults);
	} else if (manualActions.length > 0) {
		lines.push("", "**Manual QA**:");
		for (const m of manualActions) lines.push(`- [ ] ${resolveVars(m.instruction ?? "", vars)}`);
	}
}

/** Appends visual inspection lines for canvas config cards. */
function appendCanvasVisualLines(lines: string[], stepResult: StepResult, vars: Record<string, string>): void {
	const viActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "visual-inspection");
	if (viActions.length === 0) return;
	const hasWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	lines.push("", hasWarnings ? "**Visual Inspection — FAILED**:" : "**Visual Inspection**:");
	for (const vi of viActions) lines.push(`- ${resolveVars(vi.prompt ?? "", vars)}`);
	if (hasWarnings) {
		for (const w of stepResult.warnings!) lines.push(`**Reason**: ${w}`);
	}
}

/** Builds improvement card nodes above a step group. */
function buildImprovementNodes(stepId: string, improvements: StepDefinition["improvements"], groupX: number): CanvasNode[] {
	if (!improvements || improvements.length === 0) return [];
	const improvCenterX = groupX + Math.round((GROUP_WIDTH - IMPROVEMENT_WIDTH) / 2);
	return improvements.map((imp, ii) => {
		const impLines = [`## ${imp.title}`];
		if (imp.description) { impLines.push(""); impLines.push(imp.description); }
		if (imp.priority) { impLines.push(""); impLines.push(`**Priority**: ${imp.priority}`); }
		return {
			id: nId(`${stepId}-imp-${ii}`),
			type: "text" as const,
			text: impLines.join("\n"),
			x: improvCenterX,
			y: -((ii + 1) * (IMPROVEMENT_HEIGHT + IMPROVEMENT_GAP)),
			width: IMPROVEMENT_WIDTH,
			height: IMPROVEMENT_HEIGHT,
			color: "3",
		};
	});
}

/** Builds action group nodes and edges below a step group. */
function buildActionNodes(
	stepId: string, actions: StepAction[], groupX: number,
	screenshotBasePath: string, vars: Record<string, string> | undefined,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	if (actions.length === 0) return { nodes: [], edges: [] };
	const actionNodes: CanvasNode[] = [];
	const actionEdges: CanvasEdge[] = [];
	const actionCenterX = groupX + Math.round((GROUP_WIDTH - ACTION_GROUP_WIDTH) / 2);
	let actionY = ACTION_GROUP_START_Y;
	let prevActionNodeId = gId(stepId);
	let screenshotCounter = 0;

	for (let ai = 0; ai < actions.length; ai++) {
		const action = actions[ai];
		const actionId = `${stepId}-a${ai}`;
		const isScreenshot = action.tool === "screenshot";
		const height = isScreenshot ? ACTION_GROUP_HEIGHT_SCREENSHOT : ACTION_GROUP_HEIGHT_DEFAULT;

		const node: CanvasNode = {
			id: gId(actionId), type: "group",
			label: formatActionText(action, vars),
			x: actionCenterX, y: actionY, width: ACTION_GROUP_WIDTH, height,
		};

		const color = actionColor(action.tool);
		if (color) node.color = color;

		if (isScreenshot) {
			const label = action.label ?? String(++screenshotCounter);
			node.backgroundStyle = "ratio";
			node.background = `${screenshotBasePath}/${stepId}--${label}.png`;
		}

		actionNodes.push(node);
		actionEdges.push({
			id: eId(stripPrefix(prevActionNodeId), actionId),
			fromNode: prevActionNodeId, fromSide: "bottom",
			toNode: gId(actionId), toSide: "top",
		});

		prevActionNodeId = gId(actionId);
		actionY += height + ACTION_GROUP_GAP_Y;
	}

	return { nodes: actionNodes, edges: actionEdges };
}

/** Builds the events summary text for the canvas circle node. */
function buildCanvasEventsText(steps: StepResult[], passedSteps: number, failedSteps: number, durationMs: number, trace: TraceData | null): string {
	const lines: string[] = ["## Events Summary"];
	lines.push(`**Steps**: ${passedSteps} passed, ${failedSteps} failed`);
	lines.push(`**Duration**: ${formatDuration(durationMs)}`);
	lines.push("");

	for (const sr of steps) {
		const cb = sr.status === "pass" ? "[x]" : sr.status === "fail" ? "[!]" : "[ ]";
		lines.push(`- ${cb} ${sr.step.itBlock ?? `${sr.step.guideSection} — ${sr.step.title}`} (${formatDuration(sr.durationMs)})`);
	}

	if (trace?.summary?.eventFrequency) {
		const sorted = Object.entries(trace.summary.eventFrequency).sort((a, b) => b[1] - a[1]).slice(0, 8);
		lines.push("", "### Top Events", "| Event | Count |", "|---|---|");
		for (const [type, count] of sorted) lines.push(`| \`${type}\` | ${count} |`);
	}

	return lines.join("\n");
}

/**
 * Generates an Obsidian Canvas JSON object for a journey.
 * Pure function — no I/O.
 */
function buildCanvasStartNodes(journeyTitle: string, dateStr: string, configFilePath: string | null, circleCenterY: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];
	nodes.push({
		id: nId("start"), type: "text",
		text: `# Start\n**${journeyTitle}**\n${dateStr}`,
		styleAttributes: { shape: "circle", textAlign: "center" },
		x: START_X, y: circleCenterY, width: CIRCLE_WIDTH, height: CIRCLE_HEIGHT, color: "4",
	});
	if (configFilePath) {
		nodes.push({
			id: nId("config"), type: "file", file: configFilePath,
			x: START_X - Math.round((400 - CIRCLE_WIDTH) / 2), y: circleCenterY + CIRCLE_HEIGHT + 60,
			width: 400, height: 400,
		});
		edges.push({ id: eId("config", "start"), fromNode: nId("config"), fromSide: "top", toNode: nId("start"), toSide: "bottom" });
	}
	return { nodes, edges };
}

function resolveStepCanvasColor(stepResult: StepResult): string | undefined {
	const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	const effectiveStatus = (stepResult.status === "pass" && hasStepWarnings) ? "partial-pass" : stepResult.status;
	return CANVAS_STATUS_COLOR[effectiveStatus];
}

function resolveStepScreenshotPath(stepResult: StepResult, screenshotBasePath: string): string | null {
	const stepScreenshots = stepResult.screenshotFiles ?? (stepResult.screenshotFile ? [stepResult.screenshotFile] : []);
	return stepScreenshots.length > 0 ? `${screenshotBasePath}/${stepScreenshots[0]}` : null;
}

function buildStepGroupAndConfigNodes(
	s: StepDefinition, stepResult: StepResult, groupX: number, journeySlug: string,
	canvasVars: Record<string, string>, screenshotBasePath: string,
): CanvasNode[] {
	const stepColor = resolveStepCanvasColor(stepResult);
	const screenshotPath = resolveStepScreenshotPath(stepResult, screenshotBasePath);
	const groupNode: CanvasNode = {
		id: gId(s.id), type: "group", label: `${s.guideSection}. ${s.title}`,
		x: groupX, y: 0, width: GROUP_WIDTH, height: GROUP_HEIGHT, backgroundStyle: "ratio",
	};
	if (stepColor) groupNode.color = stepColor;
	if (screenshotPath) groupNode.background = screenshotPath;

	const configNode: CanvasNode = {
		id: nId(`${s.id}-config`), type: "text",
		text: buildCanvasConfigLines(stepResult, journeySlug, canvasVars).join("\n"),
		x: groupX + INNER_MARGIN_LEFT, y: 16, width: ACTION_WIDTH, height: GROUP_HEIGHT - 16 - ACTION_MARGIN_BOTTOM,
	};
	if (stepColor) configNode.color = stepColor;

	return [groupNode, configNode];
}

function buildCanvasStepGroup(
	stepResult: StepResult, index: number, journeySlug: string, canvasVars: Record<string, string>,
	screenshotBasePath: string, vars: Record<string, string> | undefined, prevNodeId: string,
): { nodes: CanvasNode[]; edges: CanvasEdge[]; nextPrevId: string } {
	const s = stepResult.step;
	const groupX = FIRST_GROUP_X + index * (GROUP_WIDTH + GROUP_SPACING_X);
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];

	nodes.push(...buildStepGroupAndConfigNodes(s, stepResult, groupX, journeySlug, canvasVars, screenshotBasePath));
	nodes.push(...buildImprovementNodes(s.id, s.improvements, groupX));

	const actionResult = buildActionNodes(s.id, s.actions ?? [], groupX, screenshotBasePath, vars);
	nodes.push(...actionResult.nodes);
	edges.push(...actionResult.edges);

	edges.push({
		id: eId(stripPrefix(prevNodeId), s.id),
		fromNode: prevNodeId, fromSide: "right", toNode: gId(s.id), toSide: "left",
	});

	return { nodes, edges, nextPrevId: gId(s.id) };
}

function buildCanvasEndNodes(
	eventsX: number, circleCenterY: number, journeyPassed: boolean, journeyPartial: boolean,
	passedSteps: number, totalSteps: number, skippedSteps: number, durationMs: number,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	const endX = eventsX + EVENTS_SIZE + GROUP_SPACING_X;
	const endLabel = journeyPartial ? "PARTIAL PASS" : journeyPassed ? "PASS" : "FAIL";
	const endSummary = skippedSteps > 0 ? `${passedSteps}/${totalSteps} steps (${skippedSteps} skipped)` : `${passedSteps}/${totalSteps} steps`;
	const nodes: CanvasNode[] = [{
		id: nId("end"), type: "text",
		text: `# ${endLabel}\n${endSummary}\n${formatDuration(durationMs)}`,
		styleAttributes: { shape: "circle", textAlign: "center" },
		x: endX, y: circleCenterY, width: CIRCLE_WIDTH, height: CIRCLE_HEIGHT,
		color: journeyPartial ? "5" : journeyPassed ? "4" : "1",
	}];
	const edges: CanvasEdge[] = [{ id: eId("events", "end"), fromNode: nId("events"), fromSide: "right", toNode: nId("end"), toSide: "left" }];
	return { nodes, edges };
}

interface CanvasJourneyFields {
	canvasVars: Record<string, string>; journeySlug: string; journeyTitle: string;
	steps: StepResult[]; passedSteps: number; failedSteps: number; skippedSteps: number;
	totalSteps: number; durationMs: number;
}

function extractCanvasJourneyFields(data: Record<string, unknown>): CanvasJourneyFields {
	const journeySlug = (data.journey as string) ?? "unknown";
	return {
		canvasVars: (data.variables as Record<string, string>) ?? {},
		journeySlug,
		journeyTitle: journeySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
		steps: (data.steps as StepResult[]) ?? [],
		passedSteps: (data.passed as number) ?? 0,
		failedSteps: (data.failed as number) ?? 0,
		skippedSteps: (data.skipped as number) ?? 0,
		totalSteps: (data.totalSteps as number) ?? 0,
		durationMs: (data.durationMs as number) ?? 0,
	};
}

function buildCanvasStepGroups(
	fields: CanvasJourneyFields, screenshotBasePath: string, vars: Record<string, string> | undefined,
): { nodes: CanvasNode[]; edges: CanvasEdge[]; prevNodeId: string } {
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];
	let prevNodeId = nId("start");
	for (let i = 0; i < fields.steps.length; i++) {
		const group = buildCanvasStepGroup(fields.steps[i], i, fields.journeySlug, fields.canvasVars, screenshotBasePath, vars, prevNodeId);
		nodes.push(...group.nodes);
		edges.push(...group.edges);
		prevNodeId = group.nextPrevId;
	}
	return { nodes, edges, prevNodeId };
}

function buildCanvasEventsAndEnd(
	fields: CanvasJourneyFields, trace: TraceData | null, prevNodeId: string, circleCenterY: number,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];
	const lastGroupX = fields.steps.length > 0 ? FIRST_GROUP_X + (fields.steps.length - 1) * (GROUP_WIDTH + GROUP_SPACING_X) : START_X + CIRCLE_WIDTH;
	const eventsX = lastGroupX + GROUP_WIDTH + GROUP_SPACING_X;
	const eventsY = Math.round((GROUP_HEIGHT - EVENTS_SIZE) / 2);

	nodes.push({
		id: nId("events"), type: "text",
		text: buildCanvasEventsText(fields.steps, fields.passedSteps, fields.failedSteps, fields.durationMs, trace),
		x: eventsX, y: eventsY, width: EVENTS_SIZE, height: EVENTS_SIZE,
	});
	edges.push({
		id: eId(stripPrefix(prevNodeId), "events"),
		fromNode: prevNodeId, fromSide: "right", toNode: nId("events"), toSide: "left",
	});

	const journeyPassed = fields.failedSteps === 0 && fields.passedSteps > 0;
	const journeyPartial = journeyPassed && fields.skippedSteps > 0;
	const end = buildCanvasEndNodes(eventsX, circleCenterY, journeyPassed, journeyPartial, fields.passedSteps, fields.totalSteps, fields.skippedSteps, fields.durationMs);
	nodes.push(...end.nodes);
	edges.push(...end.edges);
	return { nodes, edges };
}

function generateJourneyCanvas(data: Record<string, unknown>, screenshotBasePath: string, trace: TraceData | null, configFilePath: string | null): CanvasResult {
	const fields = extractCanvasJourneyFields(data);
	const circleCenterY = Math.round((GROUP_HEIGHT - CIRCLE_HEIGHT) / 2);

	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];

	const start = buildCanvasStartNodes(fields.journeyTitle, (data.date as string)?.substring(0, 10) ?? "", configFilePath, circleCenterY);
	nodes.push(...start.nodes);
	edges.push(...start.edges);

	const stepGroups = buildCanvasStepGroups(fields, screenshotBasePath, data.variables as Record<string, string> | undefined);
	nodes.push(...stepGroups.nodes);
	edges.push(...stepGroups.edges);

	const eventsAndEnd = buildCanvasEventsAndEnd(fields, trace, stepGroups.prevNodeId, circleCenterY);
	nodes.push(...eventsAndEnd.nodes);
	edges.push(...eventsAndEnd.edges);

	return { metadata: { version: "1.0-1.0", frontmatter: {}, startNode: nId("start") }, nodes, edges };
}

/** Writes content to a file and logs the output path. */
function writeReport(dir: string, filename: string, content: string, label: string): void {
	disk.mkdirSync(dir, { recursive: true });
	const outputPath = paths.join(dir, filename);
	disk.writeFileSync(outputPath, content, "utf-8");
	log(`[report] ${label}: ${outputPath}`);
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Reads the latest Event Trace JSON from the dev traces directory. */
function readLatestEventTrace(): TraceData | null {
	if (!disk.existsSync(DEV_TRACES_DIR())) return null;

	const files = disk.readdirSync(DEV_TRACES_DIR())
		.filter((f) => f.endsWith("-Event Trace.json") || f.endsWith("-event-trace.json"))
		.sort()
		.reverse();

	if (files.length === 0) return null;

	try {
		return JSON.parse(disk.readFileSync(paths.join(DEV_TRACES_DIR(), files[0]), "utf-8")) as TraceData;
	} catch {
		return null;
	}
}

/** Reads startup history from plugin data.json. */
function readStartupPerf(): StartupPerf | null {
	for (const candidate of DATA_JSON_CANDIDATES()) {
		if (disk.existsSync(candidate)) {
			try {
				const data = JSON.parse(disk.readFileSync(candidate, "utf-8")) as Record<string, unknown>;
				const sizeBytes = disk.statSync(candidate).size;
				const history = (data?.perfAggregator as Record<string, unknown> | undefined)?.startupHistory as number[] ?? [];
				return { history, sizeBytes };
			} catch { /* try next */ }
		}
	}
	return null;
}

/** Appends the Performance section to the document. */
function buildPerfLines(startupPerf: StartupPerf | null, doc: InstanceType<typeof Document>): void {
	if (!startupPerf || startupPerf.history.length === 0) return;

	const { history, sizeBytes } = startupPerf;
	const sorted = [...history].sort((a, b) => a - b);
	const last = round(history[history.length - 1] ?? 0);
	const p50 = round(percentile(sorted, 0.5));
	const p95 = round(percentile(sorted, 0.95));
	const max = round(sorted[sorted.length - 1] ?? 0);

	doc.addSeparator().addBlank();
	doc.heading(2, "Performance").addBlank();
	doc.callout("tip", "Startup", [
		`Last: ${last}ms | p50: ${p50}ms | p95: ${p95}ms | Max: ${max}ms`,
		`Measurements: ${history.length} | data.json: ${formatBytes(sizeBytes)}`,
	]);
	doc.addBlank();
}

/** Renders the top-N events frequency table if data is available. */
function renderTopEventsTable(doc: InstanceType<typeof Document>, freq: Record<string, number> | undefined, limit: number): void {
	if (!freq || Object.keys(freq).length === 0) return;
	const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit);
	doc.heading(3, "Top Events").addBlank();
	doc.table(["Event", "Count"], sorted.map(([type, count]) => [`\`${type}\``, String(count)]));
	doc.addBlank();
}

function buildTraceSummaryText(summary: TraceSummary | undefined, durationMs: number): string {
	const totalEvents = summary?.totalEvents ?? 0;
	const perfEvents = summary?.perfEvents ?? 0;
	const uniqueTypes = summary?.uniqueTypes ?? 0;
	return `Events: ${totalEvents} | Perf: ${perfEvents} | Types: ${uniqueTypes} | Duration: ${formatDuration(durationMs)}`;
}

/** Appends the Event Trace section to the document. */
function buildEventTraceLines(trace: TraceData | null, doc: InstanceType<typeof Document>): void {
	if (!trace) return;

	doc.addSeparator().addBlank();
	doc.heading(2, "Event Trace").addBlank();
	doc.callout("abstract", "Trace Summary", [buildTraceSummaryText(trace.summary, trace.durationMs ?? 0)]);
	doc.addBlank();

	renderTopEventsTable(doc, trace.summary?.eventFrequency, 15);
	buildPerfEventStats(trace.perfEvents ?? [], doc);

	doc.text("Full details: [[Event Trace]]");
	doc.addBlank();
}

/** Parsed perf event data grouped by category. */
interface PerfEventBuckets {
	startupServices: StartupService[];
	startupTotal: StartupTotal | null;
	storageOps: StorageOp[];
	queries: QueryOp[];
	dispatches: DispatchOp[];
	alerts: AlertOp[];
}

/** Safely parses a perf event payload to an object. */
function parsePerfPayload(payload: string | Record<string, unknown>): Record<string, unknown> | null {
	try {
		return typeof payload === "string" ? JSON.parse(payload) as Record<string, unknown> : payload as Record<string, unknown>;
	} catch { return null; }
}

function classifyStartupService(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.service && p.durationMs !== undefined) {
		buckets.startupServices.push({ service: p.service as string, durationMs: p.durationMs as number });
	}
}

function classifyStartupTotal(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.durationMs !== undefined) {
		buckets.startupTotal = { durationMs: p.durationMs as number, serviceCount: (p.serviceCount as number) ?? 0 };
	}
}

function classifyStorageOp(type: string, p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.key && p.durationMs !== undefined) {
		buckets.storageOps.push({ key: p.key as string, op: type === "perf.storage.loaded" ? "load" : "save", durationMs: p.durationMs as number, sizeBytes: (p.sizeBytes as number) ?? 0 });
	}
}

function classifyQuery(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.queryId && p.durationMs !== undefined) {
		buckets.queries.push({ queryId: p.queryId as string, durationMs: p.durationMs as number, sourceRows: (p.sourceRows as number) ?? 0, resultRows: (p.resultRows as number) ?? 0 });
	}
}

function classifyDispatch(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.eventType && p.durationMs !== undefined) {
		buckets.dispatches.push({ eventType: p.eventType as string, handlerCount: (p.handlerCount as number) ?? 0, durationMs: p.durationMs as number });
	}
}

function classifyAlert(p: Record<string, unknown>, buckets: PerfEventBuckets): void {
	if (p.metric) {
		buckets.alerts.push({ metric: p.metric as string, value: (p.value as number) ?? 0, threshold: (p.threshold as number) ?? 0 });
	}
}

type PerfClassifier = (p: Record<string, unknown>, buckets: PerfEventBuckets) => void;

const PERF_CLASSIFIER_MAP: Record<string, PerfClassifier> = {
	"perf.startup.service": classifyStartupService,
	"perf.startup.total": classifyStartupTotal,
	"perf.storage.loaded": (p, b) => classifyStorageOp("perf.storage.loaded", p, b),
	"perf.storage.saved": (p, b) => classifyStorageOp("perf.storage.saved", p, b),
	"perf.query.executed": classifyQuery,
	"perf.event.dispatched": classifyDispatch,
	"perf.alert": classifyAlert,
};

/** Classifies a single perf event into the appropriate bucket. */
function classifyPerfEvent(e: PerfTraceEvent, buckets: PerfEventBuckets): void {
	const p = parsePerfPayload(e.payload);
	if (!p) return;
	const classifier = PERF_CLASSIFIER_MAP[e.type];
	if (classifier) classifier(p, buckets);
}

/** Renders startup perf section. */
function renderPerfStartup(doc: InstanceType<typeof Document>, startupTotal: StartupTotal | null, startupServices: StartupService[]): void {
	if (!startupTotal && startupServices.length === 0) return;
	doc.heading(4, "Startup").addBlank();
	if (startupTotal) {
		doc.text(`Total startup: **${Math.round(startupTotal.durationMs)}ms** (${startupTotal.serviceCount} services)`);
		doc.addBlank();
	}
	if (startupServices.length > 0) {
		const sorted = [...startupServices].sort((a, b) => b.durationMs - a.durationMs);
		doc.table(["Service", "Duration"], sorted.map((s) => [s.service, `${Math.round(s.durationMs)}ms`]));
		doc.addBlank();
	}
}

/** Renders storage operations perf section. */
function renderPerfStorage(doc: InstanceType<typeof Document>, storageOps: StorageOp[]): void {
	if (storageOps.length === 0) return;
	const LIMIT = 20;
	doc.heading(4, "Storage Operations").addBlank();
	const loadOps = storageOps.filter(o => o.op === "load");
	const saveOps = storageOps.filter(o => o.op === "save");
	doc.text(`Load: ${loadOps.length} ops (${Math.round(loadOps.reduce((s, o) => s + o.durationMs, 0))}ms) | Save: ${saveOps.length} ops (${Math.round(saveOps.reduce((s, o) => s + o.durationMs, 0))}ms)`);
	doc.addBlank();
	const sorted = [...storageOps].sort((a, b) => b.durationMs - a.durationMs);
	const rows: string[][] = sorted.slice(0, LIMIT).map((o) => {
		const size = o.sizeBytes > 1024 ? `${(o.sizeBytes / 1024).toFixed(1)}KB` : `${o.sizeBytes}B`;
		return [o.key, o.op, `${Math.round(o.durationMs)}ms`, size];
	});
	if (sorted.length > LIMIT) rows.push([`*...and ${sorted.length - LIMIT} more*`, "", "", ""]);
	doc.table(["Key", "Op", "Duration", "Size"], rows);
	doc.addBlank();
}

/** Renders query execution perf section. */
function renderPerfQueries(doc: InstanceType<typeof Document>, queries: QueryOp[]): void {
	if (queries.length === 0) return;
	doc.heading(4, "Query Execution").addBlank();
	const totalMs = Math.round(queries.reduce((s, q) => s + q.durationMs, 0));
	const maxQ = queries.reduce((m, q) => q.durationMs > m.durationMs ? q : m, queries[0]);
	doc.text(`Queries: ${queries.length} | Total: ${totalMs}ms | Avg: ${(totalMs / queries.length).toFixed(1)}ms | Slowest: ${maxQ.queryId} (${Math.round(maxQ.durationMs)}ms)`);
	doc.addBlank();
	const sorted = [...queries].sort((a, b) => b.durationMs - a.durationMs);
	doc.table(["Query", "Duration", "Source Rows", "Result Rows"], sorted.map((q) => [q.queryId, `${Math.round(q.durationMs)}ms`, String(q.sourceRows), String(q.resultRows)]));
	doc.addBlank();
}

/** Renders event dispatch timing perf section. */
function renderPerfDispatches(doc: InstanceType<typeof Document>, dispatches: DispatchOp[]): void {
	if (dispatches.length === 0) return;
	doc.heading(4, "Event Dispatch Timing").addBlank();
	const totalMs = dispatches.reduce((s, d) => s + d.durationMs, 0);
	const byType = new Map<string, DispatchAggregate>();
	for (const d of dispatches) {
		const existing = byType.get(d.eventType) ?? { count: 0, totalMs: 0, maxMs: 0 };
		existing.count++;
		existing.totalMs += d.durationMs;
		existing.maxMs = Math.max(existing.maxMs, d.durationMs);
		byType.set(d.eventType, existing);
	}
	doc.text(`Dispatches: ${dispatches.length} | Total: ${Math.round(totalMs)}ms | Avg: ${(totalMs / dispatches.length).toFixed(2)}ms`);
	doc.addBlank();
	const sorted = [...byType.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
	doc.table(["Event", "Dispatches", "Total", "Avg", "Max"], sorted.map(([type, stats]) => {
		return [`\`${type}\``, String(stats.count), `${Math.round(stats.totalMs)}ms`, `${(stats.totalMs / stats.count).toFixed(2)}ms`, `${Math.round(stats.maxMs)}ms`];
	}));
	doc.addBlank();
}

/** Renders perf alerts section. */
function renderPerfAlerts(doc: InstanceType<typeof Document>, alerts: AlertOp[]): void {
	if (alerts.length === 0) return;
	doc.heading(4, "Performance Alerts").addBlank();
	doc.callout("warning", "Threshold Violations",
		alerts.map((a) => `- **${a.metric}**: ${Math.round(a.value)}ms (threshold: ${Math.round(a.threshold)}ms)`),
	);
	doc.addBlank();
}

/**
 * Builds detailed performance statistics from perf.* trace events.
 */
function buildPerfEventStats(perfEvents: PerfTraceEvent[], doc: InstanceType<typeof Document>): void {
	if (!perfEvents || perfEvents.length === 0) return;

	const buckets: PerfEventBuckets = {
		startupServices: [], startupTotal: null, storageOps: [], queries: [], dispatches: [], alerts: [],
	};
	for (const e of perfEvents) classifyPerfEvent(e, buckets);

	doc.heading(3, "Event Performance Statistics").addBlank();
	doc.callout("info", "Metrics", [
		`Perf events: ${perfEvents.length} | Startup services: ${buckets.startupServices.length} | Storage ops: ${buckets.storageOps.length} | Queries: ${buckets.queries.length} | Dispatches: ${buckets.dispatches.length} | Alerts: ${buckets.alerts.length}`,
	]);
	doc.addBlank();

	renderPerfStartup(doc, buckets.startupTotal, buckets.startupServices);
	renderPerfStorage(doc, buckets.storageOps);
	renderPerfQueries(doc, buckets.queries);
	renderPerfDispatches(doc, buckets.dispatches);
	renderPerfAlerts(doc, buckets.alerts);
}

/** Copies screenshot .png files from src to dest directory, removing stale dest files first. */
function copyScreenshots(srcDir: string, destDir: string): void {
	if (!disk.existsSync(srcDir)) return;

	disk.mkdirSync(destDir, { recursive: true });

	// Remove stale screenshots in dest that are not in src
	const srcFiles = new Set(disk.readdirSync(srcDir).filter((f) => f.endsWith(".png")));
	for (const file of disk.readdirSync(destDir)) {
		if (!file.endsWith(".png")) continue;
		if (!srcFiles.has(file)) {
			disk.rmSync(paths.join(destDir, file), { force: true });
		}
	}

	// Copy current screenshots
	for (const file of srcFiles) {
		disk.copyFileSync(paths.join(srcDir, file), paths.join(destDir, file));
	}
}

/** Writes a single journey's report, canvas, and screenshots to both vaults. */
function writeJourneyOutputs(
	dir: string, data: Record<string, unknown>, date: string, now: Date, trace: TraceData | null,
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
	const devJourneyDir = paths.join(DEV_JOURNEYS_DIR(), title);
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

/** Aggregates action stats across all journeys and returns per-journey stats map. */
function aggregateJourneyStats(journeys: JourneyEntry[]): {
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

/** Builds E2E report frontmatter. */
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

/** Builds compact error trace lines for failure summary (lighter than full buildErrorContextLines). */
function buildCompactTraceLines(ctx: ErrorContext): string[] {
	const lines: string[] = [];
	appendCompactDomLines(lines, ctx);
	appendCompactEventsAndErrors(lines, ctx);
	return lines;
}

/** Collects vitest-level failures from suites. */
function collectVitestFailures(vitest: VitestResults | null): Array<{ suite: string; testCase: VitestCase; hookError: string | null }> {
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

/** Renders the Failures section of the E2E report. */
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

/** Renders the Warnings section of the E2E report. */
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

/** Renders the Action Coverage section. */
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

/** Determines the mark and suffix for a reconciled test case in the suite checklist. */
function caseMarkAndSuffix(status: string, caseName: string, warningItBlocks: Set<string>, suiteHookFailed: boolean): { mark: string; suffix: string } {
	if (status === "passed") {
		const hasWarning = warningItBlocks.size > 0 && [...warningItBlocks].some((w) => caseName.includes(w));
		return { mark: hasWarning ? "[~]" : "[x]", suffix: "" };
	}
	if (status === "failed") return { mark: "[!]", suffix: "" };
	if (status === "skipped") return { mark: "[-]", suffix: " — *Skipped (previous run passed)*" };
	if (status === "dev") return { mark: "[-]", suffix: " — *Dev (not yet implemented)*" };
	return { mark: suiteHookFailed ? "[ ]" : "[-]", suffix: "" };
}

function collectWarningItBlocks(journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): Set<string> {
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

/** Renders the Test Suites section with reconciled data. */
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

function buildJourneyStatsLine(stats: ActionStatsReturn): string {
	const lc = stats.create_files + stats.delete_files + stats.open_files + stats.close_leaves;
	return `Actions: ${stats.total} | Screenshots: ${stats.screenshots} | Assertions: ${stats.assertions} | Manual: ${stats.manual_checks}` +
		(stats.visual_inspections > 0 ? ` | Visual: ${stats.visual_inspections}` : "") +
		` | Notices: ${stats.notices}` +
		(stats.theme_changes > 0 ? ` | Themes: ${stats.theme_changes}` : "") +
		(lc > 0 ? ` | Lifecycle: ${lc}` : "");
}

function resolveJourneyStatus(data: Record<string, unknown>): { status: string; suffix: string; stepsSummary: string } {
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

/** Renders the Journeys summary section. */
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

/** Cleans up temporary result files after report generation. */
function cleanupResults(journeys: JourneyEntry[]): void {
	try { if (disk.existsSync(VITEST_RESULTS())) disk.rmSync(VITEST_RESULTS(), { force: true }); } catch { /* ignore */ }
	for (const { dir, data } of journeys) {
		try { disk.rmSync(paths.join(dir, `${(data.journey as string)}-results.json`), { force: true }); } catch { /* ignore */ }
	}
}

function generateJourneyReports(
	journeys: JourneyEntry[], date: string, now: Date, trace: TraceData | null,
): Array<{ title: string; data: Record<string, unknown> }> {
	const journeyReportNames: Array<{ title: string; data: Record<string, unknown> }> = [];
	for (const { dir, data } of journeys) {
		const result = writeJourneyOutputs(dir, data, date, now, trace);
		journeyReportNames.push({ title: result.title, data });
	}
	return journeyReportNames;
}

interface ReconciledTotals {
	totalPassed: number; totalFailed: number; totalSkipped: number;
	totalDev: number; totalTests: number; overallStatus: string; totalDurationMs: number;
}

const EMPTY_COUNTS = { totalPassed: 0, totalFailed: 0, totalSkipped: 0, totalDev: 0, totalTests: 0 } as const;

function extractReconciledCounts(reconciled: ReturnType<typeof reconcileResults>): { totalPassed: number; totalFailed: number; totalSkipped: number; totalDev: number; totalTests: number } {
	if (!reconciled) return { ...EMPTY_COUNTS };
	const { totalPassed, totalFailed, totalSkipped, totalDev = 0, totalTests } = reconciled;
	return { totalPassed, totalFailed, totalSkipped, totalDev, totalTests };
}

function computeReconciledTotals(vitest: VitestResults | null, journeys: JourneyEntry[]): ReconciledTotals {
	const counts = extractReconciledCounts(reconcileResults(vitest, journeys));
	const effectiveSkipped = counts.totalSkipped + counts.totalDev + (resolveMode() !== "full" ? 1 : 0);
	const hasJourneyWarnings = journeys.some(({ data }) => ((data.steps as StepResult[]) ?? []).some((r) => r.warnings && r.warnings.length > 0));
	const overallStatus = resolveStatus(counts.totalPassed, counts.totalFailed, counts.totalTests, effectiveSkipped, hasJourneyWarnings);
	return { ...counts, overallStatus, totalDurationMs: vitest?.durationMs ?? 0 };
}

function collectFailedSteps(journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): Array<{ journeyTitle: string; stepResult: StepResult }> {
	const failedSteps: Array<{ journeyTitle: string; stepResult: StepResult }> = [];
	for (const { title, data } of journeyReportNames) {
		for (const sr of ((data.steps as StepResult[]) ?? [])) {
			if (sr.status === "fail") failedSteps.push({ journeyTitle: title, stepResult: sr });
		}
	}
	return failedSteps;
}

function renderE2EDocBody(
	doc: InstanceType<typeof Document>, totals: ReconciledTotals,
	vitest: VitestResults | null, journeys: JourneyEntry[],
	journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>,
	aggregate: ActionStatsReturn, allTools: string[],
	perJourneyStats: Map<string, ActionStatsReturn>,
	startupPerf: StartupPerf | null, trace: TraceData | null,
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
		doc.list(vitest.suites.map((s) => `\`${paths.relative(e2e().projectRoot, s.file).replace(/\\/g, "/")}\``));
		doc.addBlank();
	}

	const reconciled = reconcileResults(vitest, journeys);
	if (reconciled) renderTestSuitesSection(doc, reconciled, journeyReportNames);

	buildPerfLines(startupPerf, doc);
	buildEventTraceLines(trace, doc);
	renderJourneysSummarySection(doc, journeyReportNames, perJourneyStats);
}

function writeE2EOutputs(content: string, now: Date, overallStatus: string): void {
	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const e2eFilename = `${safeTimestamp}-e2e-report${overallStatus === "partial-pass" ? " (Partial)" : ""}.md`;
	writeReport(TEST_VAULT(), "E2E Report.md", content, "E2EReport written");
	writeReport(paths.join(e2e().projectRoot, "docs", "reports", "e2e"), "E2E Report.md", content, "E2EReport current");
	writeReport(DEV_RUNS_DIR(), e2eFilename, content, "E2EReport archived");
}

function generateReport(): void {
	const vitest = readVitestResults();
	const journeys = readJourneyResults();

	if (!vitest && journeys.length === 0) {
		log("[report] No E2E results found — run E2E tests first.");
		return;
	}

	const now = clock.now();
	const date = now.toISOString();
	const startupPerf = readStartupPerf();
	const trace = readLatestEventTrace();

	const journeyReportNames = generateJourneyReports(journeys, date, now, trace);
	const totals = computeReconciledTotals(vitest, journeys);
	const { aggregate, perJourney: perJourneyStats } = aggregateJourneyStats(journeys);
	const allTools = aggregate.tools;

	const doc = Document.create("E2E Report");
	const testSuiteLinks = (vitest?.suites ?? []).map((s) => `[[${paths.relative(e2e().projectRoot, s.file).replace(/\\/g, "/")}]]`);

	buildE2EFrontmatter(doc, {
		date, ...totals, aggregate, allTools, testSuiteLinks,
		journeyReportLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCanvasLinks: journeyReportNames.map(({ title }) => `[[${title}]]`),
		journeyCount: journeys.length, trace, startupPerf,
	});

	renderE2EDocBody(doc, totals, vitest, journeys, journeyReportNames, aggregate, allTools, perJourneyStats, startupPerf, trace);
	writeE2EOutputs(doc.toString(), now, totals.overallStatus);
	cleanupResults(journeys);
}

generateReport();
