/**
 * e2e-report-canvas-helpers.ts — Action text formatting and config card line builders
 * for journey canvas generation.
 */

import type { ManualVerification, StepAction, StepDefinition, StepResult } from "./e2e-report-types.js";
import { formatDuration, resolveVars } from "./e2e-report-utils.js";

// ── Color Maps ──────────────────────────────────────────────────

const ACTION_COLOR_MAP: Record<string, string> = {
	"screenshot": "6", "assert": "4", "manual": "3", "visual-inspection": "3",
	"notice": "5", "emit": "1", "theme": "2",
	"create-file": "0", "delete-file": "0", "open-file": "0", "close-leaves": "0",
};

export function actionColor(tool: string): string | undefined {
	return ACTION_COLOR_MAP[tool];
}

// ── Action Text Formatting ──────────────────────────────────────

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
	"input": (a, r, d) => `**input** \`${a.selector}\`\n\u2192 "${r(a.value ?? "")}"${d}`,
	"highlight": (a, _r, d) => `**highlight** \`${a.selector}\` [${a.style ?? "element"}]${d}`,
	"wait": (a) => `**wait** ${a.ms}ms`,
	"screenshot": (a, _r, d) => `**screenshot** ${a.label ?? "(auto)"}${d}`,
	"navigate": (a, r, d) => `**navigate** ${r(a.hub ?? "")} \u2192 ${r(a.tab ?? "")}${d}`,
	"assert": formatAssertText,
	"emit": (a, r, d) => `**emit** \`${r(a.event ?? "")}\`${d}`,
	"eval": (a, _r, d) => `**eval**${a.store ? ` \u2192 \`${a.store}\`` : ""}${d}`,
	"notice": (a, r, d) => `**notice** ${r(a.message ?? "")}${d}`,
	"manual": (a, r) => `**manual**\n${r(a.instruction ?? "")}`,
	"visual-inspection": (a, r) => `**visual-inspection**\n${r(a.prompt ?? "")}`,
	"theme": (a, r, d) => `**theme** \u2192 \`${r(a.theme ?? "")}\`${d}`,
	"create-file": (a, r, d) => `**create-file** \`${r(a.path ?? "")}\`${d}`,
	"delete-file": (a, r, d) => `**delete-file** \`${r(a.path ?? "")}\`${d}`,
	"open-file": (a, r, d) => `**open-file** \`${r(a.path ?? "")}\`${d}`,
	"close-leaves": (a, r, d) => `**close-leaves** \`${r(a.viewType ?? "")}\`${d}`,
};

export function formatActionText(action: StepAction, vars?: Record<string, string>): string {
	const desc = action.description ? `\n${action.description}` : "";
	const r = (s: string): string => resolveVars(s, vars);
	const formatter = ACTION_FORMAT_MAP[action.tool];
	return formatter ? formatter(action, r, desc) : `**${action.tool}**${desc}`;
}

// ── Config Card Lines ───────────────────────────────────────────

export function appendConfigDescriptionLines(lines: string[], s: StepDefinition): void {
	if (s.description) { lines.push(s.description); lines.push(""); }
	if (s.expectedInput) lines.push(`**Input**: ${s.expectedInput}`);
	if (s.expectedOutput) lines.push(`**Expected**: ${s.expectedOutput}`);
	if (s.expectedInput || s.expectedOutput) lines.push("");
}

export function appendConfigUiContextLines(lines: string[], s: StepDefinition): void {
	const ui = s.uiContext;
	if (ui?.viewName) lines.push(`**View**: ${ui.viewName} (\`${ui.view}\`)`);
	if (ui?.tabName) lines.push(`**Tab**: ${ui.tabName} (\`${ui.tab}\`)`);
	if (ui?.components?.length) lines.push(`**Components**: ${ui.components.map((c) => `\`${c}\``).join(" ")}`);
}

export function appendConfigMetadataLines(lines: string[], s: StepDefinition): void {
	if (s.events?.length) lines.push(`**Events**: ${s.events.map((e) => `\`${e}\``).join(" ")}`);
	if (s.commands?.length) lines.push(`**Commands**: ${s.commands.map((c) => `\`${c}\``).join(" ")}`);
	if (s.queries?.length) lines.push(`**Queries**: ${s.queries.map((q) => `\`${q}\``).join(" ")}`);
	if (s.interactions?.length) lines.push(`**Interactions**: ${s.interactions.map((i) => `*${i}*`).join(", ")}`);
}

export function appendManualResultLines(lines: string[], manualResults: ManualVerification[]): void {
	const allPassed = manualResults.every((m) => m.status === "pass");
	lines.push("", allPassed ? "**Manual QA \u2014 PASSED**:" : "**Manual QA \u2014 FAILED**:");
	for (const m of manualResults) {
		lines.push(`- ${m.status === "pass" ? "\u2713" : "\u2717"} ${m.instruction}`);
		if (m.notes) lines.push(`  *Notes*: ${m.notes}`);
	}
}

export function appendCanvasManualLines(lines: string[], stepResult: StepResult, vars: Record<string, string>): void {
	const manualActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "manual");
	const manualResults = stepResult.manualVerifications ?? [];
	if (manualResults.length > 0) {
		appendManualResultLines(lines, manualResults);
	} else if (manualActions.length > 0) {
		lines.push("", "**Manual QA**:");
		for (const m of manualActions) lines.push(`- [ ] ${resolveVars(m.instruction ?? "", vars)}`);
	}
}

export function appendCanvasVisualLines(lines: string[], stepResult: StepResult, vars: Record<string, string>): void {
	const viActions = (stepResult.step.actions ?? []).filter((a) => a.tool === "visual-inspection");
	if (viActions.length === 0) return;
	const hasWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	lines.push("", hasWarnings ? "**Visual Inspection \u2014 FAILED**:" : "**Visual Inspection**:");
	for (const vi of viActions) lines.push(`- ${resolveVars(vi.prompt ?? "", vars)}`);
	if (hasWarnings) {
		for (const w of stepResult.warnings!) lines.push(`**Reason**: ${w}`);
	}
}

export function buildCanvasConfigLines(
	stepResult: StepResult, journeySlug: string, canvasVars: Record<string, string>,
	canvasCheckbox: (status: string, hasWarnings: boolean) => string,
): string[] {
	const s = stepResult.step;
	const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	const cb = canvasCheckbox(stepResult.status, !!hasStepWarnings);
	const durationStr = stepResult.durationMs ? formatDuration(stepResult.durationMs) : "";

	const lines: string[] = [];
	lines.push(`**describe** ${s.describeBlock ?? journeySlug ?? ""}`);
	lines.push(`- ${cb} **it** ${s.itBlock ?? `${s.guideSection} \u2014 ${s.title}`} (${durationStr})`);
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
