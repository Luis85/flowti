/**
 * e2e-report-utils.ts
 *
 * Pure utility functions shared across E2E report modules.
 */

import { proc } from "../../../../infrastructure/proc.js";
import type { ActionStatsReturn, StepResult } from "./e2e-report-types.js";

/**
 * Resolves the E2E execution mode label from the E2E_JOURNEY env var.
 */
export function resolveMode(): string {
	const journey = proc.env().E2E_JOURNEY;
	if (!journey) return "full";
	return journey;
}

/**
 * Resolves {{key}} template variables in a string using a variables map.
 */
export function resolveVars(template: string, variables?: Record<string, string>): string {
	if (!template) return "";
	return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string): string => {
		if (variables && key in variables) return variables[key];
		return "\u2014";
	});
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const totalSec = ms / 1000;
	if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
	const min = Math.floor(totalSec / 60);
	const sec = Math.round(totalSec % 60);
	return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

/**
 * Returns the callout type for a given status.
 */
export function statusCallout(status: string): string {
	if (status === "partial-pass") return "warning";
	if (status === "skipped") return "warning";
	if (status === "dev" || status === "dev-stopped") return "info";
	return status === "pass" ? "success" : "danger";
}

/**
 * Determines a suite/journey result status.
 */
export function resolveStatus(passed: number, failed: number, total: number, skipped: number = 0, hasWarnings: boolean = false, devStopped: boolean = false): string {
	if (devStopped) return "dev-stopped";
	if (failed > 0) return "fail";
	if (passed > 0) return (skipped > 0 || hasWarnings) ? "partial-pass" : "pass";
	return "skipped";
}

export function statusLabel(status: string): string {
	if (status === "partial-pass") return "PARTIAL PASS";
	if (status === "skipped") return "SKIPPED";
	if (status === "dev-stopped") return "DEV";
	if (status === "dev") return "DEV";
	return status === "pass" ? "PASS" : "FAIL";
}

/** Maps tool names to their corresponding counter key in ActionStatsReturn. */
export const TOOL_COUNTER_MAP: Record<string, keyof Omit<ActionStatsReturn, "total" | "tools" | "manual_passed" | "manual_failed">> = {
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

/**
 * Computes action statistics from journey result data.
 */
export function computeActionStats(data: Record<string, unknown>): ActionStatsReturn {
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

export function round(n: number): number {
	return Math.round(n * 100) / 100;
}

export function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Builds the steps summary string for the journey header. */
export function buildStepsSummary(passedSteps: number, totalSteps: number, skippedSteps: number, devSteps: number, isDevStopped: boolean): string {
	if (isDevStopped) return `${passedSteps}/${totalSteps} steps (${devSteps} dev, ${skippedSteps} skipped)`;
	if (skippedSteps > 0) return `${passedSteps}/${totalSteps} steps (${skippedSteps} skipped)`;
	return `${passedSteps}/${totalSteps} steps`;
}
