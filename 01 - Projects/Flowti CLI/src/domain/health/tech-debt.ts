/**
 * tech-debt.ts — Technical debt estimation from health metrics.
 *
 * Pure functions: takes a HealthSnapshot + HealthScore and estimates
 * remediation effort in hours based on metric shortfalls.
 */

import type { HealthSnapshot } from "./health.js";
import type { HealthScore } from "./health-scoring.js";

// ── Types ────────────────────────────────────────────────────────────

export interface DebtItem {
	category: string;
	description: string;
	estimatedHours: number;
	severity: "critical" | "high" | "medium" | "low";
}

export interface DebtEstimate {
	items: DebtItem[];
	totalHours: number;
	summary: string;
}

// ── Cost constants (hours per unit) ─────────────────────────────────

const HOURS = {
	failingTest: 0.5,
	lintError: 0.25,
	lintWarning: 0.1,
	coveragePointBelow80: 0.5,
	criticalVuln: 2,
	highVuln: 1,
	moderateVuln: 0.5,
	lowVuln: 0.1,
	buildFix: 4,
};

// ── Helpers ──────────────────────────────────────────────────────────

function collectTestDebt(snapshot: HealthSnapshot, items: DebtItem[]): void {
	if (snapshot.tests && snapshot.tests.failed > 0) {
		items.push({
			category: "Tests",
			description: `${snapshot.tests.failed} failing test${snapshot.tests.failed > 1 ? "s" : ""}`,
			estimatedHours: round(snapshot.tests.failed * HOURS.failingTest),
			severity: snapshot.tests.failed > 10 ? "critical" : snapshot.tests.failed > 3 ? "high" : "medium",
		});
	}
}

function collectLintDebt(snapshot: HealthSnapshot, items: DebtItem[]): void {
	if (!snapshot.lint) return;
	if (snapshot.lint.errors > 0) {
		items.push({
			category: "Lint",
			description: `${snapshot.lint.errors} lint error${snapshot.lint.errors > 1 ? "s" : ""}`,
			estimatedHours: round(snapshot.lint.errors * HOURS.lintError),
			severity: snapshot.lint.errors > 20 ? "high" : "medium",
		});
	}
	if (snapshot.lint.warnings > 10) {
		items.push({
			category: "Lint",
			description: `${snapshot.lint.warnings} lint warnings (above threshold of 10)`,
			estimatedHours: round((snapshot.lint.warnings - 10) * HOURS.lintWarning),
			severity: "low",
		});
	}
}

function collectCoverageDebt(snapshot: HealthSnapshot, items: DebtItem[]): void {
	if (!snapshot.coverage) return;
	const avg = (snapshot.coverage.lines + snapshot.coverage.branches + snapshot.coverage.functions) / 3;
	if (avg < 80) {
		const gap = 80 - avg;
		items.push({
			category: "Coverage",
			description: `Coverage at ${avg.toFixed(1)}% (${gap.toFixed(1)} points below 80% target)`,
			estimatedHours: round(gap * HOURS.coveragePointBelow80),
			severity: avg < 50 ? "high" : "medium",
		});
	}
}

function collectBuildDebt(snapshot: HealthSnapshot, items: DebtItem[]): void {
	if (snapshot.build && !snapshot.build.success) {
		items.push({
			category: "Build",
			description: "Build is failing",
			estimatedHours: HOURS.buildFix,
			severity: "critical",
		});
	}
}

function collectSecurityDebt(snapshot: HealthSnapshot, items: DebtItem[]): void {
	if (!snapshot.security) return;
	const { critical, high, moderate, low } = snapshot.security;
	if (critical > 0) {
		items.push({
			category: "Security",
			description: `${critical} critical vulnerabilit${critical > 1 ? "ies" : "y"}`,
			estimatedHours: round(critical * HOURS.criticalVuln),
			severity: "critical",
		});
	}
	if (high > 0) {
		items.push({
			category: "Security",
			description: `${high} high-severity vulnerabilit${high > 1 ? "ies" : "y"}`,
			estimatedHours: round(high * HOURS.highVuln),
			severity: "high",
		});
	}
	if (moderate > 0) {
		items.push({
			category: "Security",
			description: `${moderate} moderate vulnerabilit${moderate > 1 ? "ies" : "y"}`,
			estimatedHours: round(moderate * HOURS.moderateVuln),
			severity: "medium",
		});
	}
	if (low > 0) {
		items.push({
			category: "Security",
			description: `${low} low-severity vulnerabilit${low > 1 ? "ies" : "y"}`,
			estimatedHours: round(low * HOURS.lowVuln),
			severity: "low",
		});
	}
}

// ── Estimation ──────────────────────────────────────────────────────

export function estimateDebt(snapshot: HealthSnapshot, _score: HealthScore): DebtEstimate {
	const items: DebtItem[] = [];

	collectTestDebt(snapshot, items);
	collectLintDebt(snapshot, items);
	collectCoverageDebt(snapshot, items);
	collectBuildDebt(snapshot, items);
	collectSecurityDebt(snapshot, items);

	// Sort: critical first, then by hours descending
	const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.estimatedHours - a.estimatedHours);

	const totalHours = round(items.reduce((sum, i) => sum + i.estimatedHours, 0));
	const summary = totalHours === 0
		? "No technical debt detected."
		: `${items.length} item${items.length > 1 ? "s" : ""}, ~${totalHours}h estimated remediation.`;

	return { items, totalHours, summary };
}

function round(n: number): number {
	return Math.round(n * 10) / 10;
}
