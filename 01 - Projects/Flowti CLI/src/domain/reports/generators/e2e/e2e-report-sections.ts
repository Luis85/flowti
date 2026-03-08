/**
 * e2e-report-sections.ts
 *
 * Rendering helpers for the E2E summary report — failures, warnings,
 * action coverage, and test-suite sections.
 */

import type { Document } from "../../../../infrastructure/document.js";
import type {
	ActionStatsReturn, ErrorContext, StepResult,
	VitestCase, VitestResults, VitestSuite,
} from "./e2e-report-types.js";
import {
	buildStepsSummary, formatDuration,
	resolveStatus, statusCallout, statusLabel,
} from "./e2e-report-utils.js";

// ── Compact Trace Lines ─────────────────────────────────────────

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

// ── Vitest Failures ─────────────────────────────────────────────

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

// ── Failure Rendering ───────────────────────────────────────────

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

export function renderFailuresSection(
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

// ── Warnings ────────────────────────────────────────────────────

export function renderWarningsSection(doc: InstanceType<typeof Document>, journeyReportNames: Array<{ title: string; data: Record<string, unknown> }>): void {
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

export function renderActionCoverageSection(
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

export function renderTestSuitesSection(
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

export function renderJourneysSummarySection(
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
