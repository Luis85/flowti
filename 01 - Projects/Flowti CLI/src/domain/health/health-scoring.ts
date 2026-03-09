/**
 * health-scoring.ts — Health scoring with configurable thresholds.
 *
 * Pure function: takes a HealthSnapshot + optional thresholds,
 * returns a HealthScore with per-category grades (0–100) and
 * an overall letter grade (A–F).
 *
 * Thresholds come from flowti.config.json → health.thresholds.
 * Projects without config get sensible defaults (progressive opt-in).
 */

import type { HealthSnapshot } from "./health.js";

// ── Types ────────────────────────────────────────────────────────────

export interface HealthThresholds {
	coverage: { min: number; target: number };
	lint: { maxErrors: number; maxWarnings: number };
	tests: { minPassed: number };
}

export interface HealthScore {
	overall: number;
	grade: string;
	categories: {
		tests: number;
		coverage: number;
		build: number;
		lint: number;
		git: number;
	};
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
	coverage: { min: 80, target: 95 },
	lint: { maxErrors: 0, maxWarnings: 10 },
	tests: { minPassed: 100 },
};

// ── Scoring ──────────────────────────────────────────────────────────

function scoreTests(snapshot: HealthSnapshot, thresholds: HealthThresholds): number {
	if (!snapshot.tests) return 0;
	const { total, passed, failed } = snapshot.tests;
	if (total === 0) return 0;

	// Pass rate component (0–70)
	const passRate = passed / total;
	const passScore = Math.round(passRate * 70);

	// No failures bonus (0–30)
	const failureScore = failed === 0 ? 30 : Math.max(0, 30 - failed * 3);

	// Minimum passed threshold check
	const minPassed = thresholds.tests.minPassed;
	const thresholdPenalty = passed >= minPassed ? 0 : Math.round((1 - passed / minPassed) * 20);

	return clamp(passScore + failureScore - thresholdPenalty);
}

function scoreCoverage(snapshot: HealthSnapshot, thresholds: HealthThresholds): number {
	if (!snapshot.coverage) return 0;
	const { lines, branches, functions } = snapshot.coverage;
	const avg = (lines + branches + functions) / 3;

	const { min, target } = thresholds.coverage;
	if (avg >= target) return 100;
	if (avg >= min) {
		// Scale linearly between min (70) and target (100)
		return Math.round(70 + ((avg - min) / (target - min)) * 30);
	}
	// Below min: scale 0–70
	return Math.round((avg / min) * 70);
}

function scoreBuild(snapshot: HealthSnapshot): number {
	if (!snapshot.build) return 0;
	return snapshot.build.success ? 100 : 0;
}

function scoreLint(snapshot: HealthSnapshot, thresholds: HealthThresholds): number {
	if (!snapshot.lint) return 0;
	const { errors, warnings } = snapshot.lint;
	const { maxErrors, maxWarnings } = thresholds.lint;

	if (errors === 0 && warnings === 0) return 100;

	// Errors are severe: each error above max deducts 20 points
	const errorPenalty = Math.max(0, errors - maxErrors) * 20;
	// Warnings are mild: each warning above max deducts 2 points
	const warningPenalty = Math.max(0, warnings - maxWarnings) * 2;

	return clamp(100 - errorPenalty - warningPenalty);
}

function scoreGit(snapshot: HealthSnapshot): number {
	if (!snapshot.git) return 0;
	return snapshot.git.status === "clean" ? 100 : 70;
}

function clamp(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

// ── Category weights ─────────────────────────────────────────────────

const WEIGHTS = {
	tests: 0.30,
	coverage: 0.25,
	build: 0.20,
	lint: 0.15,
	git: 0.10,
};

// ── Public API ───────────────────────────────────────────────────────

export function letterGrade(score: number): string {
	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 60) return "D";
	return "F";
}

export function scoreHealth(
	snapshot: HealthSnapshot,
	thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): HealthScore {
	const categories = {
		tests: scoreTests(snapshot, thresholds),
		coverage: scoreCoverage(snapshot, thresholds),
		build: scoreBuild(snapshot),
		lint: scoreLint(snapshot, thresholds),
		git: scoreGit(snapshot),
	};

	const overall = clamp(
		categories.tests * WEIGHTS.tests +
		categories.coverage * WEIGHTS.coverage +
		categories.build * WEIGHTS.build +
		categories.lint * WEIGHTS.lint +
		categories.git * WEIGHTS.git,
	);

	return { overall, grade: letterGrade(overall), categories };
}
