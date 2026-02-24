/**
 * Tests for the function call parser and expression evaluator extensions.
 *
 * Tests the evaluateExpression function with:
 * - Function call recognition (ROUND, ABS, IF, CHANGE, PCT_CHANGE, ROLLING_AVG)
 * - Nested function calls (ROUND(PCT_CHANGE({col}), 1))
 * - Mixed expressions: {Revenue} - CHANGE({Cost})
 * - Backward compatibility with pure arithmetic expressions
 */

import { describe, it, expect } from "vitest";
import { evaluateExpression } from "../../../src/domain/analytics/AnalyticsEngine";
import { AnalyticsEngine } from "../../../src/domain/analytics/AnalyticsEngine";
import type { AnalyticsQuery, ResultRow } from "../../../src/domain/analytics/types";

describe("function call parser", () => {
	it("should still evaluate simple arithmetic expressions", () => {
		const row: ResultRow = { Revenue: 1000, Cost: 600 };
		expect(evaluateExpression("{Revenue} - {Cost}", row)).toBe(400);
	});

	it("should evaluate ROUND with column reference", () => {
		const row: ResultRow = { Value: 23.4567 };
		expect(evaluateExpression("ROUND({Value}, 2)", row)).toBe(23.46);
	});

	it("should evaluate ABS with negative value", () => {
		const row: ResultRow = { Change: -42.5 };
		expect(evaluateExpression("ABS({Change})", row)).toBe(42.5);
	});

	it("should evaluate IF returning string", () => {
		const row: ResultRow = { Margin: 5 };
		expect(evaluateExpression('IF({Margin} < 10, "Low", "OK")', row)).toBe("Low");
	});

	it("should evaluate IF returning number", () => {
		const row: ResultRow = { Margin: 15 };
		expect(evaluateExpression("IF({Margin} >= 10, {Margin}, 0)", row)).toBe(15);
	});

	it("should handle nested ROUND(ABS(...))", () => {
		const row: ResultRow = { Delta: -3.14159 };
		expect(evaluateExpression("ROUND(ABS({Delta}), 2)", row)).toBe(3.14);
	});

	it("should handle arithmetic alongside scalar functions", () => {
		const row: ResultRow = { Revenue: 1000, Cost: 600 };
		// ABS evaluates first, then arithmetic
		expect(evaluateExpression("{Revenue} - ABS({Cost})", row)).toBe(400);
	});

	it("should preserve backward compatibility for computed columns", () => {
		const row: ResultRow = { A: 100, B: 50, C: 2 };
		expect(evaluateExpression("{A} + {B} * {C}", row)).toBe(200); // 100 + (50*2)
	});

	it("should return 0 for empty expression", () => {
		const row: ResultRow = {};
		expect(evaluateExpression("", row)).toBe(0);
		expect(evaluateExpression("  ", row)).toBe(0);
	});
});

describe("window functions via AnalyticsEngine", () => {
	const engine = new AnalyticsEngine();

	function runWithComputed(computedColumns: AnalyticsQuery["computedColumns"]): AnalyticsQuery {
		return {
			sources: [{
				alias: "s",
				data: {
					headers: ["Month", "Revenue", "Cost"],
					rows: [
						["2026-01", "1000", "600"],
						["2026-02", "1200", "700"],
						["2026-03", "900", "500"],
						["2026-04", "1500", "800"],
					],
				},
			}],
			joins: [],
			columnTypeHints: [
				{ column: "Revenue", type: "number" },
				{ column: "Cost", type: "number" },
			],
			dimensions: [{ column: "Month" }],
			measures: [
				{ column: "Revenue", function: "SUM" },
				{ column: "Cost", function: "SUM" },
			],
			computedColumns,
		};
	}

	it("should compute CHANGE on a column", () => {
		const result = engine.run(runWithComputed([
			{ name: "Rev Change", expression: "CHANGE({SUM(Revenue)})" },
		]));
		expect(result.rows[0]["Rev Change"]).toBeNull(); // first row
		expect(result.rows[1]["Rev Change"]).toBe(200); // 1200 - 1000
		expect(result.rows[2]["Rev Change"]).toBe(-300); // 900 - 1200
		expect(result.rows[3]["Rev Change"]).toBe(600); // 1500 - 900
	});

	it("should compute PCT_CHANGE on a column", () => {
		const result = engine.run(runWithComputed([
			{ name: "Rev % Change", expression: "PCT_CHANGE({SUM(Revenue)})" },
		]));
		expect(result.rows[0]["Rev % Change"]).toBeNull();
		expect(result.rows[1]["Rev % Change"]).toBe(20); // (1200-1000)/1000*100
		expect(result.rows[2]["Rev % Change"]).toBe(-25); // (900-1200)/1200*100
	});

	it("should compute ROLLING_AVG on a column", () => {
		const result = engine.run(runWithComputed([
			{ name: "Rev Avg 3", expression: "ROLLING_AVG({SUM(Revenue)}, 3)" },
		]));
		expect(result.rows[0]["Rev Avg 3"]).toBeCloseTo(1000, 1);
		expect(result.rows[1]["Rev Avg 3"]).toBeCloseTo(1100, 1); // avg(1000, 1200)
		expect(result.rows[2]["Rev Avg 3"]).toBeCloseTo(1033.33, 0); // avg(1000, 1200, 900)
		expect(result.rows[3]["Rev Avg 3"]).toBeCloseTo(1200, 1); // avg(1200, 900, 1500)
	});

	it("should support window function alongside regular computed column", () => {
		const result = engine.run(runWithComputed([
			{ name: "Profit", expression: "{SUM(Revenue)} - {SUM(Cost)}" },
			{ name: "Rev Change", expression: "CHANGE({SUM(Revenue)})" },
		]));
		expect(result.rows[0]["Profit"]).toBe(400); // 1000 - 600
		expect(result.rows[0]["Rev Change"]).toBeNull();
		expect(result.rows[1]["Profit"]).toBe(500); // 1200 - 700
		expect(result.rows[1]["Rev Change"]).toBe(200);
	});

	it("should handle PCT_CHANGE with zero-division gracefully", () => {
		const query: AnalyticsQuery = {
			sources: [{
				alias: "s",
				data: {
					headers: ["Key", "Val"],
					rows: [["A", "0"], ["B", "100"]],
				},
			}],
			joins: [],
			columnTypeHints: [{ column: "Val", type: "number" }],
			dimensions: [{ column: "Key" }],
			measures: [{ column: "Val", function: "SUM" }],
			computedColumns: [{ name: "Pct", expression: "PCT_CHANGE({SUM(Val)})" }],
		};
		const result = engine.run(query);
		expect(result.rows[0]["Pct"]).toBeNull(); // first row
		expect(result.rows[1]["Pct"]).toBeNull(); // zero division (previous = 0)
	});

	it("should include computed column names in result columns", () => {
		const result = engine.run(runWithComputed([
			{ name: "Change", expression: "CHANGE({SUM(Revenue)})" },
			{ name: "Pct", expression: "PCT_CHANGE({SUM(Revenue)})" },
		]));
		expect(result.columns).toContain("Change");
		expect(result.columns).toContain("Pct");
	});

	it("existing computed column tests should not break", () => {
		const result = engine.run(runWithComputed([
			{ name: "Profit", expression: "{SUM(Revenue)} - {SUM(Cost)}" },
			{ name: "Margin", expression: "{SUM(Revenue)} / {SUM(Cost)}" },
		]));
		expect(result.rows[0]["Profit"]).toBe(400);
		expect(result.rows[0]["Margin"]).toBeCloseTo(1.6667, 3);
	});
});
