/**
 * Execution report generator — pure function.
 *
 * Converts an ExecutionResult into a frontmatter + markdown vault note.
 * Follows the same pattern as performanceReportGenerator.ts.
 */

import type { ExecutionResult } from "./types";

export interface ExecutionReportOutput {
	frontmatter: Record<string, unknown>;
	markdown: string;
}

const STATUS_ICON: Record<string, string> = { pass: "✓", fail: "✗", skip: "–" };

/** Generate a markdown execution report from a run result. */
export function generateExecutionReport(result: ExecutionResult): ExecutionReportOutput {
	const date = new Date().toISOString();
	const status = result.failed > 0 ? "failed" : "passed";

	const frontmatter: Record<string, unknown> = {
		type: "JourneyExecutionReport",
		journey: result.journeyName,
		date,
		status,
		total_steps: result.totalSteps,
		passed: result.passed,
		failed: result.failed,
		skipped: result.skipped,
		duration_ms: result.durationMs,
	};

	const lines: string[] = [];
	lines.push(`# Execution Report: ${result.journeyName}`);
	lines.push("");
	lines.push(`**Date**: ${date.slice(0, 10)}  `);
	lines.push(`**Status**: ${status}  `);
	lines.push(`**Duration**: ${formatDuration(result.durationMs)}`);
	lines.push("");

	// Summary table
	lines.push("## Summary");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Total steps | ${result.totalSteps} |`);
	lines.push(`| Passed | ${result.passed} |`);
	lines.push(`| Failed | ${result.failed} |`);
	lines.push(`| Skipped | ${result.skipped} |`);
	lines.push(`| Duration | ${formatDuration(result.durationMs)} |`);
	lines.push("");

	// Step results
	if (result.steps.length > 0) {
		lines.push("## Step Results");
		lines.push("");
		lines.push("| # | Status | Step | Duration | Error |");
		lines.push("|---|--------|------|----------|-------|");
		for (const step of result.steps) {
			const icon = STATUS_ICON[step.status] ?? "?";
			let errorCol = step.error ? step.error.slice(0, 80) : "";
			if (step.failedAction) {
				const ctx = step.failedAction;
				const paramStr = ctx.params ? ` (${Object.entries(ctx.params).map(([k, v]) => `${k}=${v}`).join(", ")})` : "";
				errorCol = `[${ctx.tool}#${ctx.actionIndex}${paramStr}] ${errorCol}`;
			}
			if (step.retryAttempts) {
				errorCol += ` [${step.retryAttempts} retries]`;
			}
			lines.push(`| ${step.stepIndex + 1} | ${icon} ${step.status} | ${step.stepTitle} | ${formatDuration(step.durationMs)} | ${errorCol} |`);
		}
		lines.push("");
	}

	return { frontmatter, markdown: lines.join("\n") };
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}
