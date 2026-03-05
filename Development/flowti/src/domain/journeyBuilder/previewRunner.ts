/**
 * Preview runner — validates journey step/action structure against tool schemas.
 *
 * Pure functions: validateAction(), validateStep(), runPreview()
 *
 * No I/O, no EventBus dependency. Used by the sidebar's Preview Run button
 * for dry-run validation with per-step pass/fail results.
 */
import type { JourneyAction, JourneyToolName } from "./types";
import { TOOL_SCHEMAS } from "./toolSchemas";

// ── Types ────────────────────────────────────────────────────

export interface StepPreviewResult {
	stepIndex: number;
	status: "pass" | "fail";
	errors: string[];
}

export interface PreviewRunResult {
	totalSteps: number;
	passed: number;
	failed: number;
	steps: StepPreviewResult[];
}

// ── Validation ───────────────────────────────────────────────

/** Validate a single action against its tool schema. Returns error messages. */
export function validateAction(action: JourneyAction, stepIndex: number, actionIndex: number): string[] {
	const errors: string[] = [];
	const prefix = `Step ${stepIndex + 1}, action ${actionIndex + 1}`;
	const schema = TOOL_SCHEMAS[action.tool as JourneyToolName];

	if (!schema) {
		errors.push(`${prefix}: unknown tool "${action.tool}"`);
		return errors;
	}

	for (const field of schema.fields) {
		if (!field.required) continue;

		// Skip required check if visibleWhen condition is not met
		if (field.visibleWhen) {
			const actual = String(action[field.visibleWhen.field] ?? "");
			if (!field.visibleWhen.values.includes(actual)) continue;
		}

		const value = action[field.key];
		if (value === undefined || value === null || value === "") {
			errors.push(`${prefix} (${action.tool}): missing required "${field.key}"`);
		}
	}

	return errors;
}

/** Validate a step: title, actions presence, and each action's schema. */
export function validateStep(
	step: { id: string; title: string; actions: JourneyAction[] },
	stepIndex: number,
): StepPreviewResult {
	const errors: string[] = [];

	if (!step.title.trim()) {
		errors.push(`Step ${stepIndex + 1}: missing title`);
	}

	if (step.actions.length === 0) {
		errors.push(`Step ${stepIndex + 1}: no actions defined`);
	}

	for (let i = 0; i < step.actions.length; i++) {
		errors.push(...validateAction(step.actions[i], stepIndex, i));
	}

	return {
		stepIndex,
		status: errors.length === 0 ? "pass" : "fail",
		errors,
	};
}

/** Run preview validation across all steps. */
export function runPreview(
	steps: Array<{ id: string; title: string; actions: JourneyAction[] }>,
): PreviewRunResult {
	const results = steps.map((step, i) => validateStep(step, i));
	return {
		totalSteps: steps.length,
		passed: results.filter((r) => r.status === "pass").length,
		failed: results.filter((r) => r.status === "fail").length,
		steps: results,
	};
}
