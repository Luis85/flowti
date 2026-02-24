// @vitest-environment happy-dom
/**
 * Flow 33: Analytics Hub — Trend Intelligence
 *
 * End-to-end integration test covering the trend intelligence workflow:
 * - Trend calculations: CHANGE, PCT_CHANGE, ROLLING_AVG on aggregated results
 * - Expression functions: ROUND, ABS, IF on computed columns
 * - Nested expressions: ROUND(PCT_CHANGE({col}), 1)
 * - Conditional formatting: rule creation, evaluation, color application
 * - Dashboard pinning: pin/unpin, persistence, max-3 enforcement
 * - Query list ordering: saved queries above sources
 * - Edge cases: single row (null trends), zero-division, empty result
 *
 * Exercises: AnalyticsEngine, AnalyticsService, evaluateExpression,
 *            evaluateConditionalRules, trendCalculations, expressionFunctions
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import { AnalyticsEngine } from "../../src/domain/analytics/AnalyticsEngine";
import { evaluateExpression } from "../../src/domain/analytics/AnalyticsEngine";
import type { AnalyticsQuery, AnalyticsResult, AnalyticsState, ConditionalRule } from "../../src/domain/analytics/types";
import { evaluateConditionalRules } from "../../src/domain/analytics/conditionalFormatting";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const MONTHLY_HEADERS = ["Month", "Category", "Revenue", "Cost"];
const MONTHLY_ROWS: string[][] = [
	["2026-01", "Electronics", "5000", "3000"],
	["2026-01", "Furniture", "3000", "1800"],
	["2026-02", "Electronics", "5500", "3200"],
	["2026-02", "Furniture", "2800", "1700"],
	["2026-03", "Electronics", "6000", "3500"],
	["2026-03", "Furniture", "3200", "2000"],
	["2026-04", "Electronics", "4500", "2800"],
	["2026-04", "Furniture", "3500", "2100"],
];

function createMonthlyQuery(computedColumns?: AnalyticsQuery["computedColumns"]): AnalyticsQuery {
	return {
		sources: [{
			alias: "sales",
			data: { headers: MONTHLY_HEADERS, rows: MONTHLY_ROWS },
		}],
		joins: [],
		columnTypeHints: [
			{ column: "Revenue", type: "number" },
			{ column: "Cost", type: "number" },
		],
		dimensions: [{ column: "Month" }],
		measures: [
			{ column: "Revenue", function: "SUM", label: "Total Revenue" },
			{ column: "Cost", function: "SUM", label: "Total Cost" },
		],
		computedColumns,
	};
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 33: Trend Intelligence", () => {
	let eventBus: IEventBus;
	let analyticsService: AnalyticsService;
	const engine = new AnalyticsEngine();

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		analyticsService = new AnalyticsService({
			storage: mock.storage,
			eventBus,
		});
		await analyticsService.load();
	});

	// ── Trend calculations ────────────────────────────────

	describe("trend calculations on aggregated results", () => {
		it("should compute CHANGE showing month-over-month absolute difference", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Rev Change", expression: "CHANGE({Total Revenue})" },
			]));

			expect(result.rows).toHaveLength(4);
			expect(result.rows[0]["Rev Change"]).toBeNull(); // first month — no prior
			expect(result.rows[1]["Rev Change"]).toBe(300); // 8300 - 8000
			expect(result.rows[2]["Rev Change"]).toBe(900); // 9200 - 8300
			expect(result.rows[3]["Rev Change"]).toBe(-1200); // 8000 - 9200
		});

		it("should compute PCT_CHANGE showing percentage trends", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Rev % Change", expression: "PCT_CHANGE({Total Revenue})" },
			]));

			expect(result.rows[0]["Rev % Change"]).toBeNull();
			// Month 1→2: (8300-8000)/8000 * 100 = 3.75
			expect(result.rows[1]["Rev % Change"]).toBeCloseTo(3.75, 1);
		});

		it("should compute ROLLING_AVG for smoothed trend lines", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Rev Avg", expression: "ROLLING_AVG({Total Revenue}, 3)" },
			]));

			expect(result.rows[0]["Rev Avg"]).toBeCloseTo(8000, 0); // avg(8000)
			expect(result.rows[1]["Rev Avg"]).toBeCloseTo(8150, 0); // avg(8000, 8300)
			expect(result.rows[2]["Rev Avg"]).toBeCloseTo(8500, 0); // avg(8000, 8300, 9200)
		});
	});

	// ── Expression functions ─────────────────────────────

	describe("expression functions on computed columns", () => {
		it("should compute ROUND for clean KPI display", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Pct", expression: "PCT_CHANGE({Total Revenue})" },
			]));
			// PCT_CHANGE returns many decimal places; ROUND cleans it up
			// But we test ROUND independently:
			const row = result.rows[1]; // has non-null PCT_CHANGE
			const roundResult = evaluateExpression("ROUND(3.756, 1)", row);
			expect(roundResult).toBe(3.8);
		});

		it("should compute ABS for absolute deltas", () => {
			const row = { "Total Revenue": 8000, "Total Cost": 4800, Delta: -3200 };
			expect(evaluateExpression("ABS({Delta})", row)).toBe(3200);
		});

		it("should compute IF for conditional classification", () => {
			// Low margin: Revenue - Cost < 4000
			const row1 = { "Total Revenue": 8000, "Total Cost": 4800, Profit: 3200 };
			expect(evaluateExpression('IF({Profit} < 4000, "Low", "OK")', row1)).toBe("Low");

			const row2 = { "Total Revenue": 9200, "Total Cost": 5500, Profit: 3700 };
			expect(evaluateExpression('IF({Profit} >= 4000, "Strong", "Weak")', row2)).toBe("Weak");
		});
	});

	// ── Nested expressions ───────────────────────────────

	describe("nested function expressions", () => {
		it("should handle ROUND(PCT_CHANGE({col}), 1) for clean percentage display", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Rev % Clean", expression: "ROUND(PCT_CHANGE({Total Revenue}), 1)" },
			]));

			expect(result.rows[0]["Rev % Clean"]).toBeNull(); // first row
			// PCT_CHANGE then ROUND
			const pct = result.rows[1]["Rev % Clean"];
			expect(pct).not.toBeNull();
			// Should be a clean 1-decimal number
			if (typeof pct === "number") {
				expect(String(pct).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
			}
		});

		it("should handle ROUND(ABS({col}), 2) for absolute rounded values", () => {
			const row = { Delta: -3.14159 };
			expect(evaluateExpression("ROUND(ABS({Delta}), 2)", row)).toBe(3.14);
		});
	});

	// ── Conditional formatting ───────────────────────────

	describe("conditional formatting in trend context", () => {
		it("should apply color rules to trend values", () => {
			const rules: ConditionalRule[] = [
				{ column: "Rev Change", operator: ">", threshold: 0, color: "positive" },
				{ column: "Rev Change", operator: "<", threshold: 0, color: "negative" },
			];

			// Positive change
			expect(evaluateConditionalRules(300, rules.filter((r) => r.column === "Rev Change"))).toBe("var(--text-success)");
			// Negative change
			expect(evaluateConditionalRules(-1200, rules.filter((r) => r.column === "Rev Change"))).toBe("var(--text-error)");
		});

		it("should persist tile conditional rules through service", async () => {
			const dashboard = await analyticsService.createDashboard("Trend Dashboard");
			const saved = await analyticsService.saveQuery(
				"Monthly Revenue",
				[{ alias: "s", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Revenue", type: "number" }],
					dimensions: [{ column: "Month" }],
					measures: [{ column: "Revenue", function: "SUM" }],
				},
			);
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "table");
			expect(tile).toBeDefined();

			// Update tile with conditional rules
			const rules: ConditionalRule[] = [
				{ column: "SUM(Revenue)", operator: ">", threshold: 5000, color: "positive" },
				{ column: "SUM(Revenue)", operator: "<", threshold: 3000, color: "negative" },
			];
			await analyticsService.updateTile(dashboard.id, tile!.id, { conditionalRules: rules });

			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].conditionalRules).toHaveLength(2);
			expect(updated!.tiles[0].conditionalRules![0].color).toBe("positive");
		});
	});

	// ── Dashboard pinning ────────────────────────────────

	describe("dashboard pinning to homepage", () => {
		it("should pin and unpin dashboards", async () => {
			const d1 = await analyticsService.createDashboard("Daily KPIs");
			const d2 = await analyticsService.createDashboard("Weekly Trends");

			expect(await analyticsService.pinDashboard(d1.id)).toBe(true);
			expect(analyticsService.isDashboardPinned(d1.id)).toBe(true);
			expect(analyticsService.getPinnedDashboardIds()).toEqual([d1.id]);

			expect(await analyticsService.pinDashboard(d2.id)).toBe(true);
			expect(analyticsService.getPinnedDashboardIds()).toHaveLength(2);

			expect(await analyticsService.unpinDashboard(d1.id)).toBe(true);
			expect(analyticsService.isDashboardPinned(d1.id)).toBe(false);
			expect(analyticsService.getPinnedDashboardIds()).toEqual([d2.id]);
		});

		it("should enforce max 3 pinned dashboards", async () => {
			const d1 = await analyticsService.createDashboard("D1");
			const d2 = await analyticsService.createDashboard("D2");
			const d3 = await analyticsService.createDashboard("D3");
			const d4 = await analyticsService.createDashboard("D4");

			await analyticsService.pinDashboard(d1.id);
			await analyticsService.pinDashboard(d2.id);
			await analyticsService.pinDashboard(d3.id);
			expect(await analyticsService.pinDashboard(d4.id)).toBe(false); // max 3
			expect(analyticsService.getPinnedDashboardIds()).toHaveLength(3);
		});

		it("should clean up pinned state when dashboard is deleted", async () => {
			const d1 = await analyticsService.createDashboard("Pinned");
			await analyticsService.pinDashboard(d1.id);
			expect(analyticsService.isDashboardPinned(d1.id)).toBe(true);

			await analyticsService.deleteDashboard(d1.id);
			expect(analyticsService.getPinnedDashboardIds()).toHaveLength(0);
		});
	});

	// ── Edge cases ───────────────────────────────────────

	describe("edge cases", () => {
		it("should return null trends for single-row result", () => {
			const query: AnalyticsQuery = {
				sources: [{
					alias: "s",
					data: {
						headers: ["Key", "Val"],
						rows: [["A", "100"]],
					},
				}],
				joins: [],
				columnTypeHints: [{ column: "Val", type: "number" }],
				dimensions: [{ column: "Key" }],
				measures: [{ column: "Val", function: "SUM" }],
				computedColumns: [
					{ name: "Change", expression: "CHANGE({SUM(Val)})" },
					{ name: "Pct", expression: "PCT_CHANGE({SUM(Val)})" },
				],
			};
			const result = engine.run(query);
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]["Change"]).toBeNull();
			expect(result.rows[0]["Pct"]).toBeNull();
		});

		it("should handle zero-division in PCT_CHANGE gracefully", () => {
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

		it("should handle empty result set without errors", () => {
			const query: AnalyticsQuery = {
				sources: [{
					alias: "s",
					data: { headers: ["Key", "Val"], rows: [] },
				}],
				joins: [],
				columnTypeHints: [{ column: "Val", type: "number" }],
				dimensions: [{ column: "Key" }],
				measures: [{ column: "Val", function: "SUM" }],
				computedColumns: [
					{ name: "Change", expression: "CHANGE({SUM(Val)})" },
					{ name: "Round", expression: "ROUND({SUM(Val)}, 2)" },
				],
			};
			const result = engine.run(query);
			expect(result.rows).toHaveLength(0);
		});

		it("should not duplicate pin when already pinned", async () => {
			const d1 = await analyticsService.createDashboard("D1");
			await analyticsService.pinDashboard(d1.id);
			expect(await analyticsService.pinDashboard(d1.id)).toBe(false);
			expect(analyticsService.getPinnedDashboardIds()).toHaveLength(1);
		});

		it("should handle IF with string results in stat-cards and tables", () => {
			const row = { Margin: 5 };
			const result = evaluateExpression('IF({Margin} < 10, "Low", "OK")', row);
			expect(typeof result).toBe("string");
			expect(result).toBe("Low");
		});

		it("should coexist trend + arithmetic computed columns", () => {
			const result = engine.run(createMonthlyQuery([
				{ name: "Profit", expression: "{Total Revenue} - {Total Cost}" },
				{ name: "Rev Change", expression: "CHANGE({Total Revenue})" },
			]));

			// Arithmetic column works
			expect(result.rows[0]["Profit"]).toBe(3200); // 8000 - 4800
			// Window column works alongside
			expect(result.rows[0]["Rev Change"]).toBeNull();
			expect(result.rows[1]["Rev Change"]).toBe(300);
		});

		it("should resolve raw column names to measure aliases in computed columns", () => {
			// User writes {Revenue} * {Cost} but measures have custom labels "Total Revenue" / "Total Cost"
			const result = engine.run(createMonthlyQuery([
				{ name: "computed_product", expression: "{Revenue} * {Cost}" },
			]));

			// Month "2026-01": Total Revenue = 8000, Total Cost = 4800
			expect(result.rows[0]["computed_product"]).toBe(8000 * 4800);
			// Month "2026-02": Total Revenue = 8300, Total Cost = 4900
			expect(result.rows[1]["computed_product"]).toBe(8300 * 4900);
		});

		it("should resolve raw column names with default measure labels", () => {
			// Measures without custom labels → labels like "SUM(quantity)"
			const result = engine.run({
				sources: [{
					alias: "data",
					data: {
						headers: ["category", "quantity", "unit_cost"],
						rows: [
							["A", "10", "5"],
							["A", "20", "3"],
							["B", "15", "8"],
						],
					},
				}],
				joins: [],
				columnTypeHints: [
					{ column: "quantity", type: "number" },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "category" }],
				measures: [
					{ column: "quantity", function: "SUM" },
					{ column: "unit_cost", function: "AVG" },
				],
				computedColumns: [
					{ name: "computed_cost", expression: "{quantity} * {unit_cost}" },
				],
			});

			// Category "A": SUM(quantity)=30, AVG(unit_cost)=4 → 30*4=120
			const rowA = result.rows.find((r) => r["category"] === "A");
			expect(rowA?.["computed_cost"]).toBe(120);
			// Category "B": SUM(quantity)=15, AVG(unit_cost)=8 → 15*8=120
			const rowB = result.rows.find((r) => r["category"] === "B");
			expect(rowB?.["computed_cost"]).toBe(120);
		});

		it("should access raw source columns without measures for per-row computation", () => {
			// User only has a COUNT measure but wants {quantity} * {unit_cost}
			const result = engine.run({
				sources: [{
					alias: "data",
					data: {
						headers: ["product", "quantity", "unit_cost"],
						rows: [
							["Widget", "10", "5.50"],
							["Gadget", "3", "12.00"],
							["Doohick", "7", "8.25"],
						],
					},
				}],
				joins: [],
				columnTypeHints: [
					{ column: "quantity", type: "number" },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "product" }],
				measures: [
					{ column: "quantity", function: "COUNT" },
				],
				computedColumns: [
					{ name: "line_total", expression: "{quantity} * {unit_cost}" },
				],
			});

			// Each product is its own group (1 row each).
			// COUNT(quantity) = 1 for each, but {quantity} should resolve to COUNT alias (=1).
			// {unit_cost} has no measure → uses raw passthrough from first row.
			const widget = result.rows.find((r) => r["product"] === "Widget");
			expect(widget?.["unit_cost"]).toBe(5.5);

			// With COUNT measure, {quantity} maps to COUNT(quantity)=1
			// So line_total = 1 * 5.50 = 5.5 (measure alias overrides raw)
			expect(widget?.["line_total"]).toBe(1 * 5.5);
		});

		it("should access raw columns with no measure on those columns at all", () => {
			// No measure on quantity or unit_cost — pure raw passthrough
			const result = engine.run({
				sources: [{
					alias: "data",
					data: {
						headers: ["product", "quantity", "unit_cost", "total"],
						rows: [
							["Widget", "10", "5.50", "55"],
							["Gadget", "3", "12.00", "36"],
						],
					},
				}],
				joins: [],
				columnTypeHints: [
					{ column: "quantity", type: "number" },
					{ column: "unit_cost", type: "number" },
					{ column: "total", type: "number" },
				],
				dimensions: [{ column: "product" }],
				measures: [
					{ column: "total", function: "SUM" },
				],
				computedColumns: [
					{ name: "computed_cost", expression: "{quantity} * {unit_cost}" },
				],
			});

			const widget = result.rows.find((r) => r["product"] === "Widget");
			expect(widget?.["computed_cost"]).toBe(10 * 5.5); // 55
			const gadget = result.rows.find((r) => r["product"] === "Gadget");
			expect(gadget?.["computed_cost"]).toBe(3 * 12); // 36
		});
	});
});
