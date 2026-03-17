/**
 * Window function implementations for trend analysis.
 *
 * These operate on the full ordered result set (not per-row) and produce
 * a new value for each row based on its position in the sequence.
 * Window functions are evaluated in pass 3 of the expression pipeline.
 */

import type { ResultRow } from "./types";

/**
 * CHANGE({column}) — absolute difference from previous row.
 * Returns null for the first row (no prior value to compare).
 */
export function computeChange(rows: ResultRow[], column: string): Array<number | null> {
	const result: Array<number | null> = [];
	for (let i = 0; i < rows.length; i++) {
		if (i === 0) {
			result.push(null);
			continue;
		}
		const current = toNumber(rows[i][column]);
		const previous = toNumber(rows[i - 1][column]);
		if (current === null || previous === null) {
			result.push(null);
		} else {
			result.push(current - previous);
		}
	}
	return result;
}

/**
 * PCT_CHANGE({column}) — percentage change from previous row.
 * Returns null for the first row and when previous value is zero (avoids division by zero).
 */
export function computePctChange(rows: ResultRow[], column: string): Array<number | null> {
	const result: Array<number | null> = [];
	for (let i = 0; i < rows.length; i++) {
		if (i === 0) {
			result.push(null);
			continue;
		}
		const current = toNumber(rows[i][column]);
		const previous = toNumber(rows[i - 1][column]);
		if (current === null || previous === null || previous === 0) {
			result.push(null);
		} else {
			result.push(((current - previous) / previous) * 100);
		}
	}
	return result;
}

/**
 * ROLLING_AVG({column}, n) — rolling average of the last n values including current.
 * Uses partial windows for the first n-1 rows (averages whatever is available).
 */
export function computeRollingAvg(rows: ResultRow[], column: string, windowSize: number): Array<number | null> {
	const result: Array<number | null> = [];
	for (let i = 0; i < rows.length; i++) {
		const start = Math.max(0, i - windowSize + 1);
		let sum = 0;
		let count = 0;
		for (let j = start; j <= i; j++) {
			const val = toNumber(rows[j][column]);
			if (val !== null) {
				sum += val;
				count++;
			}
		}
		result.push(count > 0 ? sum / count : null);
	}
	return result;
}

/** Coerce a ResultRow cell to a number, returning null for non-numeric values. */
function toNumber(value: string | number | undefined): number | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "number") return isNaN(value) ? null : value;
	const n = parseFloat(String(value));
	return isNaN(n) ? null : n;
}
