/**
 * Feature Quality Calculator — pure functions.
 *
 * Aggregates journey run data per feature, computing quality metrics
 * such as pass rate, coverage, and health trend.
 */

import type { JourneyRegistryEntry, JourneyRunSummary } from "./types";

/** Quality metrics for a single feature. */
export interface FeatureQuality {
	/** Feature name. */
	featureName: string;
	/** Number of journeys linked to this feature. */
	journeyCount: number;
	/** Journey names linked to this feature. */
	journeyNames: string[];
	/** Total steps across all linked journeys. */
	totalSteps: number;
	/** Steps that passed in the latest run of each journey. */
	passedSteps: number;
	/** Steps that failed in the latest run of each journey. */
	failedSteps: number;
	/** Overall pass rate (0-100). */
	passRate: number;
	/** Health trend based on recent runs. */
	trend: "improving" | "degrading" | "stable" | "unknown";
}

/**
 * Groups journeys by feature and computes quality metrics per feature.
 *
 * A journey is linked to a feature if:
 * 1. Its `feature` field matches the feature name, OR
 * 2. Its `prd` field matches the feature name, OR
 * 3. Its `domain` field matches the feature name
 *
 * @param journeys - All registered journeys
 * @param featureNames - List of known feature names to compute quality for
 * @returns Array of FeatureQuality records, sorted by feature name
 */
export function computeFeatureQuality(
	journeys: JourneyRegistryEntry[],
	featureNames: string[],
): FeatureQuality[] {
	return featureNames.map((featureName) => {
		const linked = journeys.filter((j) =>
			j.feature === featureName ||
			j.prd === featureName ||
			j.domain === featureName,
		);

		let passedSteps = 0;
		let failedSteps = 0;
		let totalSteps = 0;

		for (const j of linked) {
			const latest = j.lastRunResult ?? j.runHistory[j.runHistory.length - 1];
			if (latest) {
				passedSteps += latest.passed;
				failedSteps += latest.failed;
				totalSteps += latest.totalSteps;
			} else {
				totalSteps += j.stepCount;
			}
		}

		const passRate = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;
		const trend = computeTrend(linked);

		return {
			featureName,
			journeyCount: linked.length,
			journeyNames: linked.map((j) => j.name),
			totalSteps,
			passedSteps,
			failedSteps,
			passRate,
			trend,
		};
	}).sort((a, b) => a.featureName.localeCompare(b.featureName));
}

/**
 * Computes health trend from the last 5 runs across all linked journeys.
 * Compares the first half to the second half of recent runs.
 */
function computeTrend(journeys: JourneyRegistryEntry[]): FeatureQuality["trend"] {
	const allRuns: JourneyRunSummary[] = [];
	for (const j of journeys) {
		allRuns.push(...j.runHistory);
		if (j.lastRunResult) allRuns.push(j.lastRunResult);
	}

	if (allRuns.length < 2) return "unknown";

	// Sort by date descending, take last 5
	const recent = allRuns
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 5);

	const midpoint = Math.floor(recent.length / 2);
	const newer = recent.slice(0, midpoint);
	const older = recent.slice(midpoint);

	const newerRate = averagePassRate(newer);
	const olderRate = averagePassRate(older);
	const diff = newerRate - olderRate;

	if (diff > 10) return "improving";
	if (diff < -10) return "degrading";
	return "stable";
}

function averagePassRate(runs: JourneyRunSummary[]): number {
	if (runs.length === 0) return 0;
	const rates = runs.map((r) => r.totalSteps > 0 ? (r.passed / r.totalSteps) * 100 : 0);
	return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}

// ── Per-Feature Test History ────────────────────────────────

/** A single entry in a feature's test history timeline. */
export interface FeatureTestHistoryEntry {
	/** ISO date string of the run. */
	date: string;
	/** Date portion (YYYY-MM-DD) for grouping. */
	dateGroup: string;
	/** Journey name that produced this run. */
	journeyName: string;
	/** Pass rate for this run (0-100). */
	passRate: number;
	/** Total steps in this run. */
	totalSteps: number;
	/** Passed steps in this run. */
	passed: number;
	/** Failed steps in this run. */
	failed: number;
}

/** Aggregated test history for a feature. */
export interface FeatureTestHistory {
	/** Feature name. */
	featureName: string;
	/** All run entries, sorted newest first. */
	entries: FeatureTestHistoryEntry[];
	/** Grouped by date (YYYY-MM-DD), newest first. */
	dateGroups: Array<{ date: string; entries: FeatureTestHistoryEntry[] }>;
	/** Health trend: improving / degrading / stable / unknown. */
	trend: "improving" | "degrading" | "stable" | "unknown";
}

/**
 * Computes per-feature test history from all linked journeys.
 *
 * @param journeys - All registered journeys
 * @param featureName - The feature name to compute history for
 * @returns FeatureTestHistory with timeline entries and date grouping
 */
export function computeFeatureTestHistory(
	journeys: JourneyRegistryEntry[],
	featureName: string,
): FeatureTestHistory {
	const linked = journeys.filter((j) =>
		j.feature === featureName ||
		j.prd === featureName ||
		j.domain === featureName,
	);

	const entries: FeatureTestHistoryEntry[] = [];

	for (const j of linked) {
		const allRuns = [...j.runHistory];
		if (j.lastRunResult) allRuns.push(j.lastRunResult);

		for (const run of allRuns) {
			entries.push({
				date: run.date,
				dateGroup: run.date.slice(0, 10),
				journeyName: j.name,
				passRate: run.totalSteps > 0 ? Math.round((run.passed / run.totalSteps) * 100) : 0,
				totalSteps: run.totalSteps,
				passed: run.passed,
				failed: run.failed,
			});
		}
	}

	// Sort newest first
	entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	// Group by date
	const groupMap = new Map<string, FeatureTestHistoryEntry[]>();
	for (const entry of entries) {
		const group = groupMap.get(entry.dateGroup) ?? [];
		group.push(entry);
		groupMap.set(entry.dateGroup, group);
	}

	const dateGroups = [...groupMap.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([date, groupEntries]) => ({ date, entries: groupEntries }));

	const trend = computeTrend(linked);

	return { featureName, entries, dateGroups, trend };
}
