/**
 * Test pyramid calculator — pure functions.
 *
 * Computes the 3-layer test pyramid state from journey registry entries
 * and optional flow/unit metrics (Expert mode).
 */

import type { JourneyRegistryEntry, PyramidLayer, TestPyramidState, TrendDirection } from "./types";

/** Compute the full test pyramid from journey data and optional suite metrics. */
export function computePyramid(
	e2eJourneys: JourneyRegistryEntry[],
	flowSuiteCount?: number,
	flowPassRate?: number,
	unitSuiteCount?: number,
	unitPassRate?: number,
): TestPyramidState {
	return {
		e2e: computeE2eLayer(e2eJourneys),
		flow: {
			count: flowSuiteCount ?? 0,
			passRate: flowPassRate ?? 0,
			trend: "stable" as TrendDirection,
		},
		unit: {
			count: unitSuiteCount ?? 0,
			passRate: unitPassRate ?? 0,
			trend: "stable" as TrendDirection,
		},
	};
}

/** Apply trend indicators by comparing current pyramid to a baseline. */
export function applyTrends(current: TestPyramidState, baseline: TestPyramidState): TestPyramidState {
	return {
		e2e: { ...current.e2e, trend: computeTrend(current.e2e.count, baseline.e2e.count) },
		flow: { ...current.flow, trend: computeTrend(current.flow.count, baseline.flow.count) },
		unit: { ...current.unit, trend: computeTrend(current.unit.count, baseline.unit.count) },
	};
}

/** Compute trend direction from current vs baseline count. */
export function computeTrend(current: number, baseline: number): TrendDirection {
	if (current > baseline) return "up";
	if (current < baseline) return "down";
	return "stable";
}

// ── Helpers ──────────────────────────────────────────────────

function computeE2eLayer(journeys: JourneyRegistryEntry[]): PyramidLayer {
	const count = journeys.length;
	if (count === 0) return { count: 0, passRate: 0, trend: "stable" };

	let passing = 0;
	for (const j of journeys) {
		const latest = j.lastRunResult ?? j.runHistory[j.runHistory.length - 1];
		if (latest && latest.failed === 0) passing++;
	}

	return {
		count,
		passRate: Math.round((passing / count) * 100),
		trend: "stable",
	};
}
