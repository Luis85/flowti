/**
 * quality-gate.ts — Evaluate quality gates against a health snapshot.
 *
 * Pure functions: take a HealthSnapshot + HealthScore + QualityGateConfig,
 * return pass/fail results. Used by `publish` to block releases and by
 * `publish:check` to preview gate status.
 *
 * Config lives in flowti.config.json → health.qualityGates:
 *   { enabled: true, minScore: 70, rules: [{ metric: "tests.failed", operator: "==", value: 0 }] }
 *
 * Supported metrics (dot-path into HealthSnapshot):
 *   tests.total, tests.passed, tests.failed, tests.suites
 *   coverage.lines, coverage.branches, coverage.functions
 *   build.success (1 = true, 0 = false)
 *   lint.errors, lint.warnings
 *   components
 *   score.overall, score.tests, score.coverage, score.build, score.lint, score.git
 */

import type { HealthSnapshot } from "./health.js";
import type { HealthScore } from "./health-scoring.js";
import type { QualityGateConfig, QualityGateRule, QualityGateOperator } from "../../infrastructure/types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RuleResult {
	rule: QualityGateRule;
	actual: number | null;
	passed: boolean;
}

export interface GateResult {
	passed: boolean;
	scoreCheck: { required: number; actual: number; passed: boolean } | null;
	rules: RuleResult[];
}

// ── Metric resolution ────────────────────────────────────────────────

/**
 * Resolve a dot-path metric string to a numeric value from the snapshot/score.
 * Returns null when the metric section is unavailable (e.g., no test data).
 */
function resolveScoreMetric(score: HealthScore, field: string | undefined): number | null {
	if (field === "overall") return score.overall;
	const cat = field as keyof HealthScore["categories"];
	if (cat && cat in score.categories) return score.categories[cat];
	return null;
}

function resolveSectionField(section: unknown, field: string | undefined): number | null {
	if (!field || typeof section !== "object") return null;
	const value = (section as Record<string, unknown>)[field];
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number") return value;
	return null;
}

export function resolveMetric(
	snapshot: HealthSnapshot,
	score: HealthScore,
	metric: string,
): number | null {
	const parts = metric.split(".");

	if (parts[0] === "score") return resolveScoreMetric(score, parts[1]);
	if (parts[0] === "components") return snapshot.components;

	const section = snapshot[parts[0] as keyof HealthSnapshot];
	if (section == null) return null;
	if (typeof section === "number") return section;
	if (typeof section === "string") return null;

	return resolveSectionField(section, parts[1]);
}

// ── Operator evaluation ──────────────────────────────────────────────

function evaluateOperator(actual: number, operator: QualityGateOperator, value: number): boolean {
	switch (operator) {
		case ">=": return actual >= value;
		case "<=": return actual <= value;
		case "==": return actual === value;
	}
}

// ── Gate evaluation ──────────────────────────────────────────────────

/**
 * Evaluate all quality gates. Returns overall pass/fail plus per-rule details.
 * A gate with `enabled: false` or no config always passes.
 */
export function evaluateQualityGates(
	snapshot: HealthSnapshot,
	score: HealthScore,
	config: QualityGateConfig | undefined,
): GateResult {
	if (!config || config.enabled === false) {
		return { passed: true, scoreCheck: null, rules: [] };
	}

	let allPassed = true;

	// Check minimum score
	let scoreCheck: GateResult["scoreCheck"] = null;
	if (config.minScore != null) {
		const passed = score.overall >= config.minScore;
		scoreCheck = { required: config.minScore, actual: score.overall, passed };
		if (!passed) allPassed = false;
	}

	// Check individual rules
	const rules: RuleResult[] = [];
	for (const rule of config.rules ?? []) {
		const actual = resolveMetric(snapshot, score, rule.metric);
		const passed = actual !== null && evaluateOperator(actual, rule.operator, rule.value);
		rules.push({ rule, actual, passed });
		if (!passed) allPassed = false;
	}

	return { passed: allPassed, scoreCheck, rules };
}

// ── Default gates ────────────────────────────────────────────────────

/** Sensible default quality gates for projects that enable gating without custom rules. */
export const DEFAULT_QUALITY_GATES: QualityGateConfig = {
	enabled: true,
	minScore: 60,
	rules: [
		{ metric: "tests.failed", operator: "==", value: 0 },
		{ metric: "lint.errors", operator: "==", value: 0 },
	],
};
