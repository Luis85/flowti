/**
 * Tests for trend/window function calculations:
 * CHANGE, PCT_CHANGE, ROLLING_AVG.
 */

import { describe, it, expect } from "vitest";
import { computeChange, computePctChange, computeRollingAvg } from "../../../src/domain/analytics/trendCalculations";
import type { ResultRow } from "../../../src/domain/analytics/types";

function makeRows(values: number[]): ResultRow[] {
	return values.map((v) => ({ Month: "2026-01", Revenue: v }));
}

describe("trendCalculations", () => {
	// ── CHANGE ──────────────────────────────────────────

	describe("computeChange", () => {
		it("should return null for first row", () => {
			const rows = makeRows([100, 200, 150]);
			const result = computeChange(rows, "Revenue");
			expect(result[0]).toBeNull();
		});

		it("should compute absolute difference from previous row", () => {
			const rows = makeRows([100, 200, 150]);
			const result = computeChange(rows, "Revenue");
			expect(result[1]).toBe(100); // 200 - 100
			expect(result[2]).toBe(-50); // 150 - 200
		});

		it("should handle negative changes", () => {
			const rows = makeRows([500, 300, 100]);
			const result = computeChange(rows, "Revenue");
			expect(result[1]).toBe(-200);
			expect(result[2]).toBe(-200);
		});

		it("should return null for non-numeric values", () => {
			const rows: ResultRow[] = [
				{ Revenue: 100 },
				{ Revenue: "not-a-number" },
				{ Revenue: 200 },
			];
			const result = computeChange(rows, "Revenue");
			expect(result[0]).toBeNull();
			expect(result[1]).toBeNull(); // can't compute: "not-a-number"
			expect(result[2]).toBeNull(); // can't compute: previous is "not-a-number"
		});

		it("should handle single row", () => {
			const rows = makeRows([42]);
			const result = computeChange(rows, "Revenue");
			expect(result).toEqual([null]);
		});

		it("should handle empty rows", () => {
			expect(computeChange([], "Revenue")).toEqual([]);
		});
	});

	// ── PCT_CHANGE ──────────────────────────────────────

	describe("computePctChange", () => {
		it("should return null for first row", () => {
			const rows = makeRows([100, 150]);
			const result = computePctChange(rows, "Revenue");
			expect(result[0]).toBeNull();
		});

		it("should compute percentage change from previous row", () => {
			const rows = makeRows([100, 150, 120]);
			const result = computePctChange(rows, "Revenue");
			expect(result[1]).toBe(50); // (150-100)/100 * 100
			expect(result[2]).toBeCloseTo(-20, 5); // (120-150)/150 * 100
		});

		it("should return null for zero-division (previous = 0)", () => {
			const rows = makeRows([0, 100]);
			const result = computePctChange(rows, "Revenue");
			expect(result[1]).toBeNull();
		});

		it("should compute 100% for doubling", () => {
			const rows = makeRows([50, 100]);
			const result = computePctChange(rows, "Revenue");
			expect(result[1]).toBe(100);
		});

		it("should compute -50% for halving", () => {
			const rows = makeRows([200, 100]);
			const result = computePctChange(rows, "Revenue");
			expect(result[1]).toBe(-50);
		});

		it("should handle single row", () => {
			const rows = makeRows([42]);
			const result = computePctChange(rows, "Revenue");
			expect(result).toEqual([null]);
		});
	});

	// ── ROLLING_AVG ────────────────────────────────────

	describe("computeRollingAvg", () => {
		it("should compute rolling average with partial windows for early rows", () => {
			const rows = makeRows([10, 20, 30, 40, 50]);
			const result = computeRollingAvg(rows, "Revenue", 3);
			expect(result[0]).toBe(10); // avg(10)
			expect(result[1]).toBe(15); // avg(10, 20)
			expect(result[2]).toBe(20); // avg(10, 20, 30)
			expect(result[3]).toBe(30); // avg(20, 30, 40)
			expect(result[4]).toBe(40); // avg(30, 40, 50)
		});

		it("should handle window size of 1 (identity)", () => {
			const rows = makeRows([10, 20, 30]);
			const result = computeRollingAvg(rows, "Revenue", 1);
			expect(result).toEqual([10, 20, 30]);
		});

		it("should handle window size larger than row count", () => {
			const rows = makeRows([10, 20]);
			const result = computeRollingAvg(rows, "Revenue", 5);
			expect(result[0]).toBe(10);
			expect(result[1]).toBe(15);
		});

		it("should return null when all values are non-numeric", () => {
			const rows: ResultRow[] = [
				{ Revenue: "n/a" },
				{ Revenue: "n/a" },
			];
			const result = computeRollingAvg(rows, "Revenue", 3);
			expect(result[0]).toBeNull();
			expect(result[1]).toBeNull();
		});
	});
});
