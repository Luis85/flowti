/**
 * report-diff.ts — Compare two reports by frontmatter metrics.
 *
 * Pure functions that parse frontmatter from report files,
 * compute deltas between numeric fields, and format a human-readable diff.
 */

import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";

// ── Types ────────────────────────────────────────────────────────────

export interface MetricDelta {
	key: string;
	previous: number;
	current: number;
	delta: number;
	/** "+12", "-3", "0" */
	formatted: string;
}

export interface ReportDiff {
	category: string;
	previousFile: string;
	currentFile: string;
	deltas: MetricDelta[];
	unchanged: string[];
}

// ── Skip keys that aren't meaningful metrics ─────────────────────────

const SKIP_KEYS = new Set(["type", "project", "date", "schema_version"]);

// ── Pure diff logic ──────────────────────────────────────────────────

/** Extract numeric frontmatter values from report content. */
export function extractMetrics(content: string): Record<string, number> {
	const fm = parseFrontmatterContent(content);
	if (!fm) return {};

	const metrics: Record<string, number> = {};
	for (const [key, value] of Object.entries(fm)) {
		if (SKIP_KEYS.has(key)) continue;
		if (typeof value === "number") {
			metrics[key] = value;
		} else if (typeof value === "boolean") {
			metrics[key] = value ? 1 : 0;
		}
	}
	return metrics;
}

/** Compare two sets of metrics and produce deltas. */
export function compareMetrics(
	previous: Record<string, number>,
	current: Record<string, number>,
): { deltas: MetricDelta[]; unchanged: string[] } {
	const deltas: MetricDelta[] = [];
	const unchanged: string[] = [];
	const allKeys = [...new Set([...Object.keys(previous), ...Object.keys(current)])];

	for (const key of allKeys) {
		const prev = previous[key];
		const curr = current[key];

		// Key only in one report — skip (new/removed metric)
		if (prev === undefined || curr === undefined) continue;

		const delta = curr - prev;
		if (delta === 0) {
			unchanged.push(key);
		} else {
			const sign = delta > 0 ? "+" : "";
			const formatted = Number.isInteger(delta) ? `${sign}${delta}` : `${sign}${delta.toFixed(2)}`;
			deltas.push({ key, previous: prev, current: curr, delta, formatted });
		}
	}

	// Sort by absolute delta descending
	deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
	return { deltas, unchanged };
}

/** Build a full diff between two report content strings. */
export function diffReports(
	category: string,
	previousFile: string,
	previousContent: string,
	currentFile: string,
	currentContent: string,
): ReportDiff {
	const prevMetrics = extractMetrics(previousContent);
	const currMetrics = extractMetrics(currentContent);
	const { deltas, unchanged } = compareMetrics(prevMetrics, currMetrics);

	return { category, previousFile, currentFile, deltas, unchanged };
}
