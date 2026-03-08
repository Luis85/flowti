/**
 * e2e-report-canvas-nodes.ts — Pure helper functions for canvas node data extraction
 * and text generation, extracted from e2e-report-canvas.ts for file-size compliance.
 */

import type {
	CanvasJourneyFields, StepResult, TraceData,
} from "./e2e-report-types.js";
import { formatDuration } from "./e2e-report-utils.js";

// ── Status Constants ────────────────────────────────────────────

const CANVAS_STATUS_COLOR: Record<string, string> = { pass: "4", "partial-pass": "5", fail: "1" };

// ── Data Extraction ─────────────────────────────────────────────

export function extractCanvasJourneyFields(data: Record<string, unknown>): CanvasJourneyFields {
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

// ── Step Status Helpers ─────────────────────────────────────────

export function resolveStepCanvasColor(stepResult: StepResult): string | undefined {
	const hasStepWarnings = stepResult.warnings && stepResult.warnings.length > 0;
	const effectiveStatus = (stepResult.status === "pass" && hasStepWarnings) ? "partial-pass" : stepResult.status;
	return CANVAS_STATUS_COLOR[effectiveStatus];
}

export function resolveStepScreenshotPath(stepResult: StepResult, screenshotBasePath: string): string | null {
	const stepScreenshots = stepResult.screenshotFiles ?? (stepResult.screenshotFile ? [stepResult.screenshotFile] : []);
	return stepScreenshots.length > 0 ? `${screenshotBasePath}/${stepScreenshots[0]}` : null;
}

// ── Events Summary Text ─────────────────────────────────────────

export function buildCanvasEventsText(steps: StepResult[], passedSteps: number, failedSteps: number, durationMs: number, trace: TraceData | null): string {
	const lines: string[] = ["## Events Summary"];
	lines.push(`**Steps**: ${passedSteps} passed, ${failedSteps} failed`);
	lines.push(`**Duration**: ${formatDuration(durationMs)}`);
	lines.push("");

	for (const sr of steps) {
		const cb = sr.status === "pass" ? "[x]" : sr.status === "fail" ? "[!]" : "[ ]";
		lines.push(`- ${cb} ${sr.step.itBlock ?? `${sr.step.guideSection} \u2014 ${sr.step.title}`} (${formatDuration(sr.durationMs)})`);
	}

	if (trace?.summary?.eventFrequency) {
		const sorted = Object.entries(trace.summary.eventFrequency).sort((a, b) => b[1] - a[1]).slice(0, 8);
		lines.push("", "### Top Events", "| Event | Count |", "|---|---|");
		for (const [type, count] of sorted) lines.push(`| \`${type}\` | ${count} |`);
	}

	return lines.join("\n");
}
