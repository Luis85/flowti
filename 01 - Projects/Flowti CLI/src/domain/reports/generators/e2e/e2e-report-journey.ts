/**
 * e2e-report-journey.ts
 *
 * Journey report rendering — generates per-journey markdown reports.
 */

import { Document } from "../../../../infrastructure/document.js";
import type {
	ActionStatsReturn, ErrorContext, JourneyDataFields, JourneyReportResult,
	StepAction, StepDefinition, StepResult,
} from "./e2e-report-types.js";
import {
	computeActionStats, formatDuration, resolveMode, resolveStatus,
	resolveVars, statusCallout, statusLabel,
} from "./e2e-report-utils.js";

// ── Frontmatter ─────────────────────────────────────────────────

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

// ── Error Context ───────────────────────────────────────────────

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
export function buildErrorContextLines(ctx: ErrorContext): string[] {
	const lines: string[] = [];
	appendDomSnapshotLines(lines, ctx);
	appendRecentEventsLines(lines, ctx);
	appendConsoleAndStateLines(lines, ctx);
	return lines;
}

// ── Step Rendering ──────────────────────────────────────────────

/** Maps a raw step status to a normalized status string. */
const RAW_STATUS_MAP: Record<string, string> = { dev: "dev", pass: "pass", fail: "fail" };
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

// ── Journey Fields ──────────────────────────────────────────────

export function extractJourneyFields(data: Record<string, unknown>): JourneyDataFields {
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

// ── Journey Doc Body ────────────────────────────────────────────

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

import { buildStepsSummary } from "./e2e-report-utils.js";

/**
 * Generates a dedicated journey report with full step details and screenshots.
 */
export function generateJourneyReport(data: Record<string, unknown>, date: string): JourneyReportResult {
	const fields = extractJourneyFields(data);
	const doc = Document.create(`Journey: ${fields.journeyTitle}`);
	buildJourneyFrontmatter(doc, {
		...fields, actionStats: fields.actionStats, testSource: data.testSource as string | undefined, date,
	});
	renderJourneyDocBody(doc, fields, data);
	return { title: fields.journeyTitle, status: fields.journeyStatus, content: doc.toString() };
}
