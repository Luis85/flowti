/**
 * e2e-report-canvas.ts
 *
 * Canvas generation for journey visualization in Obsidian.
 */

import type {
	CanvasEdge, CanvasJourneyFields, CanvasNode, CanvasResult,
	ManualVerification, StepAction, StepDefinition, StepResult, TraceData,
} from "./e2e-report-types.js";
import { formatDuration, resolveVars } from "./e2e-report-utils.js";

// ── Layout Constants ────────────────────────────────────────────

const GROUP_WIDTH = 947;
const GROUP_HEIGHT = 600;
const GROUP_SPACING_X = 120;
const INNER_MARGIN_LEFT = 370;
const ACTION_WIDTH = 560;
const CANVAS_PREFIX = "e2e-";

const CIRCLE_WIDTH = 280;
const CIRCLE_HEIGHT = 239;
const START_X = -460;
const FIRST_GROUP_X = 170;

const ACTION_MARGIN_BOTTOM = 28;

const ACTION_GROUP_WIDTH = 400;
const ACTION_GROUP_HEIGHT_SCREENSHOT = 300;
const ACTION_GROUP_HEIGHT_DEFAULT = 100;
const ACTION_GROUP_GAP_Y = 3 * ACTION_GROUP_HEIGHT_DEFAULT;
const ACTION_GROUP_START_Y = GROUP_HEIGHT + 4 * ACTION_GROUP_HEIGHT_DEFAULT;

const EVENTS_SIZE = 420;

const IMPROVEMENT_WIDTH = ACTION_GROUP_WIDTH * 2;
const IMPROVEMENT_HEIGHT = ACTION_GROUP_HEIGHT_DEFAULT * 3;
const IMPROVEMENT_GAP = ACTION_GROUP_HEIGHT_DEFAULT * 2;

// ── Color Maps ──────────────────────────────────────────────────

const ACTION_COLOR_MAP: Record<string, string> = {
	"screenshot": "6", "assert": "4", "manual": "3", "visual-inspection": "3",
	"notice": "5", "emit": "1", "theme": "2",
	"create-file": "0", "delete-file": "0", "open-file": "0", "close-leaves": "0",
};

function actionColor(tool: string): string | undefined {
	return ACTION_COLOR_MAP[tool];
}

const CANVAS_STATUS_COLOR: Record<string, string> = { pass: "4", "partial-pass": "5", fail: "1" };
const CANVAS_CHECKBOX_MAP: Record<string, string> = { pass: "[x]", fail: "[!]" };

function canvasCheckbox(status: string, hasWarnings: boolean): string {
	if (status === "pass" && hasWarnings) return "[~]";
	return CANVAS_CHECKBOX_MAP[status] ?? "[ ]";
}

// ── ID Helpers ──────────────────────────────────────────────────

function nId(key: string): string { return `${CANVAS_PREFIX}n-${key}`; }
function gId(key: string): string { return `${CANVAS_PREFIX}g-${key}`; }
function eId(from: string, to: string): string { return `${CANVAS_PREFIX}e-${from}-${to}`; }
function stripPrefix(id: string): string {
	return id.replace(`${CANVAS_PREFIX}n-`, "").replace(`${CANVAS_PREFIX}g-`, "");
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

export function formatActionText(action: StepAction, vars?: Record<string, string>): string {
	const desc = action.description ? `\n${action.description}` : "";
	const r = (s: string): string => resolveVars(s, vars);
	const formatter = ACTION_FORMAT_MAP[action.tool];
	return formatter ? formatter(action, r, desc) : `**${action.tool}**${desc}`;
}

// ── Config Card Lines ───────────────────────────────────────────

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

function appendManualResultLines(lines: string[], manualResults: ManualVerification[]): void {
	const allPassed = manualResults.every((m) => m.status === "pass");
	lines.push("", allPassed ? "**Manual QA — PASSED**:" : "**Manual QA — FAILED**:");
	for (const m of manualResults) {
		lines.push(`- ${m.status === "pass" ? "\u2713" : "\u2717"} ${m.instruction}`);
		if (m.notes) lines.push(`  *Notes*: ${m.notes}`);
	}
}

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

// ── Node Builders ───────────────────────────────────────────────

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

/**
 * Generates an Obsidian Canvas JSON object for a journey.
 * Pure function — no I/O.
 */
export function generateJourneyCanvas(data: Record<string, unknown>, screenshotBasePath: string, trace: TraceData | null, configFilePath: string | null): CanvasResult {
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
