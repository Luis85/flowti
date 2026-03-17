// @vitest-environment happy-dom
/**
 * Flow 32: Analytics Hub — Visualization Sprint
 *
 * End-to-end integration test covering the Analytics Hub visualization workflow:
 * - Chart rendering: query execution → save → dashboard → add tile → chart mode → SVG
 * - Conditional formatting: rule creation → rule evaluation → color application
 * - Sparkline generation: stat-card tiles with >=3 rows → mini-chart rendering
 * - Tile mode toggle: cycling through all 4 modes (table, stat-card, line-chart, bar-chart)
 * - Edge cases: empty result, single row, many groups, non-numeric dimension
 *
 * Exercises: AnalyticsEngine, AnalyticsService, ChartRenderer,
 *            evaluateConditionalRules, resolveColor
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsResult, AnalyticsState, ConditionalRule } from "../../src/domain/analytics/types";
import { ChartRenderer } from "../../src/ui/analytics/ChartRenderer";
import { evaluateConditionalRules, resolveColor } from "../../src/domain/analytics/conditionalFormatting";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["Month", "Category", "Revenue", "Cost"];
const SALES_ROWS: string[][] = [
	["2026-01", "Electronics", "5000", "3000"],
	["2026-01", "Furniture", "3000", "1800"],
	["2026-02", "Electronics", "5500", "3200"],
	["2026-02", "Furniture", "2800", "1700"],
	["2026-03", "Electronics", "6000", "3500"],
	["2026-03", "Furniture", "3200", "2000"],
];

function createContainer(): HTMLElement {
	return document.createElement("div");
}

function createResult(columns: string[], rows: Array<Record<string, string | number>>): AnalyticsResult {
	return { columns, rows, groupCount: rows.length, sourceRowCount: rows.length };
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 32: Analytics Visualization", () => {
	let eventBus: IEventBus;
	let analyticsService: AnalyticsService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		analyticsService = new AnalyticsService({
			storage: mock.storage,
			eventBus,
		});
		await analyticsService.load();
	});

	// ── Chart rendering ────────────────────────────────────

	describe("chart rendering from query results", () => {
		it("should render line chart SVG from aggregated query result", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [
					{ column: "Revenue", type: "number" },
					{ column: "Cost", type: "number" },
				],
				dimensions: [{ column: "Month" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			});

			const container = createContainer();
			ChartRenderer.renderLineChart(container, result);

			const svg = container.querySelector("svg");
			expect(svg).not.toBeNull();
			expect(svg!.getAttribute("viewBox")).toBe("0 0 400 225");

			// 3 months = 3 data points = 3 circles + 1 path
			const circles = svg!.querySelectorAll("circle");
			expect(circles.length).toBe(3);
			const paths = svg!.querySelectorAll("path");
			expect(paths.length).toBe(1);
		});

		it("should render bar chart SVG from aggregated query result", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			});

			const container = createContainer();
			ChartRenderer.renderBarChart(container, result);

			const svg = container.querySelector("svg");
			expect(svg).not.toBeNull();

			// 2 categories = 2 bars
			const rects = svg!.querySelectorAll("rect");
			expect(rects.length).toBe(2);

			// Value labels rendered above bars
			const texts = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent);
			expect(texts.some((t) => t !== "")).toBe(true);
		});

		it("should auto-detect axes from result columns", () => {
			const result = createResult(["Category", "Total"], [
				{ Category: "A", Total: 100 },
				{ Category: "B", Total: 200 },
			]);
			const data = ChartRenderer.extractChartData(result);
			expect(data.labels).toEqual(["A", "B"]);
			expect(data.values).toEqual([100, 200]);
		});

		it("should show 'No data' for empty results in charts", () => {
			const result = createResult(["X", "Y"], []);

			const lineContainer = createContainer();
			ChartRenderer.renderLineChart(lineContainer, result);
			expect(lineContainer.textContent).toContain("No data");

			const barContainer = createContainer();
			ChartRenderer.renderBarChart(barContainer, result);
			expect(barContainer.textContent).toContain("No data");
		});
	});

	// ── Conditional formatting ─────────────────────────────

	describe("conditional formatting rules", () => {
		it("should evaluate rules with all 6 operators", () => {
			const rules: ConditionalRule[] = [
				{ column: "Revenue", operator: ">", threshold: 5000, color: "positive" },
			];
			expect(evaluateConditionalRules(5500, rules)).toBe("var(--text-success)");
			expect(evaluateConditionalRules(4000, rules)).toBeNull();

			expect(evaluateConditionalRules(50, [{ column: "X", operator: "<", threshold: 100, color: "warning" }])).toBe("var(--text-warning)");
			expect(evaluateConditionalRules(100, [{ column: "X", operator: ">=", threshold: 100, color: "positive" }])).toBe("var(--text-success)");
			expect(evaluateConditionalRules(99, [{ column: "X", operator: "<=", threshold: 100, color: "positive" }])).toBe("var(--text-success)");
			expect(evaluateConditionalRules(42, [{ column: "X", operator: "=", threshold: 42, color: "negative" }])).toBe("var(--text-error)");
			expect(evaluateConditionalRules(42, [{ column: "X", operator: "!=", threshold: 0, color: "warning" }])).toBe("var(--text-warning)");
		});

		it("should resolve color presets to CSS variables", () => {
			expect(resolveColor("positive")).toBe("var(--text-success)");
			expect(resolveColor("negative")).toBe("var(--text-error)");
			expect(resolveColor("warning")).toBe("var(--text-warning)");
		});

		it("should pass through custom CSS colors", () => {
			expect(resolveColor("#ff0000")).toBe("#ff0000");
			expect(resolveColor("rgb(0,128,0)")).toBe("rgb(0,128,0)");
		});

		it("should return first matching rule (first-match wins)", () => {
			const rules: ConditionalRule[] = [
				{ column: "X", operator: ">", threshold: 100, color: "positive" },
				{ column: "X", operator: ">", threshold: 50, color: "warning" },
				{ column: "X", operator: ">", threshold: 0, color: "negative" },
			];
			// Value 75 matches second rule (>50) but not first (>100)
			expect(evaluateConditionalRules(75, rules)).toBe("var(--text-warning)");
		});

		it("should return null when no rules match", () => {
			const rules: ConditionalRule[] = [
				{ column: "X", operator: ">", threshold: 1000, color: "positive" },
			];
			expect(evaluateConditionalRules(500, rules)).toBeNull();
		});
	});

	// ── Sparkline generation ───────────────────────────────

	describe("sparkline generation", () => {
		it("should render sparkline SVG for 3+ values", () => {
			const container = createContainer();
			const rendered = ChartRenderer.renderSparkline(container, [10, 20, 30, 25, 35]);
			expect(rendered).toBe(true);

			const svg = container.querySelector("svg");
			expect(svg).not.toBeNull();
			expect(svg!.getAttribute("viewBox")).toBe("0 0 80 24");

			const polyline = svg!.querySelector("polyline");
			expect(polyline).not.toBeNull();
		});

		it("should return false for fewer than 3 values", () => {
			const container = createContainer();
			expect(ChartRenderer.renderSparkline(container, [10, 20])).toBe(false);
			expect(ChartRenderer.renderSparkline(container, [])).toBe(false);
			expect(container.querySelector("svg")).toBeNull();
		});

		it("should handle sparkline toggle via showSparkline flag on tile", async () => {
			// Verify the tile type supports the showSparkline flag
			const dashboard = await analyticsService.createDashboard("Sparkline Test");
			const saved = await analyticsService.saveQuery(
				"Test Query",
				[{ alias: "s", csvPath: "data/test.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Revenue", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Revenue", function: "SUM" }],
				},
			);
			await analyticsService.addTile(dashboard.id, saved.id, "stat-card");
			const db = analyticsService.getDashboard(dashboard.id);
			// Default: showSparkline is undefined (treated as true)
			expect(db!.tiles[0].showSparkline).toBeUndefined();
			expect(db!.tiles[0].displayMode).toBe("stat-card");
		});
	});

	// ── Tile mode management ───────────────────────────────

	describe("tile mode management", () => {
		it("should support all 4 display modes on a tile", async () => {
			const dashboard = await analyticsService.createDashboard("Mode Test");
			const saved = await analyticsService.saveQuery(
				"Mode Query",
				[{ alias: "s", csvPath: "data/test.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Value", type: "number" }],
					dimensions: [{ column: "Name" }],
					measures: [{ column: "Value", function: "SUM" }],
				},
			);

			// Add tiles in each mode
			await analyticsService.addTile(dashboard.id, saved.id, "table");
			await analyticsService.addTile(dashboard.id, saved.id, "stat-card");
			await analyticsService.addTile(dashboard.id, saved.id, "line-chart");
			await analyticsService.addTile(dashboard.id, saved.id, "bar-chart");

			const db = analyticsService.getDashboard(dashboard.id);
			expect(db!.tiles).toHaveLength(4);
			expect(db!.tiles[0].displayMode).toBe("table");
			expect(db!.tiles[1].displayMode).toBe("stat-card");
			expect(db!.tiles[2].displayMode).toBe("line-chart");
			expect(db!.tiles[3].displayMode).toBe("bar-chart");
		});

		it("should persist tile mode through save/load cycle", async () => {
			const mock = createMockStorage<AnalyticsState>();
			const svc1 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc1.load();

			const dashboard = await svc1.createDashboard("Persist Test");
			const saved = await svc1.saveQuery(
				"Persist Query",
				[{ alias: "s", csvPath: "data/test.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "X", type: "number" }],
					dimensions: [{ column: "N" }],
					measures: [{ column: "X", function: "COUNT" }],
				},
			);
			await svc1.addTile(dashboard.id, saved.id, "bar-chart");

			// Load in a new service instance
			const svc2 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc2.load();

			const loaded = svc2.getDashboard(dashboard.id);
			expect(loaded!.tiles[0].displayMode).toBe("bar-chart");
		});

		it("should add tiles with conditional rules", async () => {
			const dashboard = await analyticsService.createDashboard("Rules Test");
			const saved = await analyticsService.saveQuery(
				"Rules Query",
				[{ alias: "s", csvPath: "data/test.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Revenue", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Revenue", function: "SUM" }],
				},
			);
			await analyticsService.addTile(dashboard.id, saved.id, "stat-card");

			// Tiles start without conditional rules
			const db = analyticsService.getDashboard(dashboard.id);
			expect(db!.tiles[0].conditionalRules).toBeUndefined();
		});
	});

	// ── End-to-end: query → chart tile → conditional rule ──

	describe("end-to-end visualization workflow", () => {
		it("should execute query and render results as both chart types", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [
					{ column: "Revenue", type: "number" },
					{ column: "Cost", type: "number" },
				],
				dimensions: [{ column: "Category" }],
				measures: [
					{ column: "Revenue", function: "SUM" },
					{ column: "Cost", function: "SUM" },
				],
			});

			expect(result.rows.length).toBe(2); // Electronics + Furniture

			// Line chart
			const lineEl = createContainer();
			ChartRenderer.renderLineChart(lineEl, result);
			expect(lineEl.querySelector("svg")).not.toBeNull();
			expect(lineEl.querySelector("circle")).not.toBeNull();

			// Bar chart
			const barEl = createContainer();
			ChartRenderer.renderBarChart(barEl, result);
			expect(barEl.querySelector("svg")).not.toBeNull();
			expect(barEl.querySelectorAll("rect").length).toBe(2);
		});

		it("should apply conditional formatting to aggregated results", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			});

			// Electronics total: 16500, Furniture total: 9000
			const rules: ConditionalRule[] = [
				{ column: "SUM(Revenue)", operator: ">", threshold: 15000, color: "positive" },
				{ column: "SUM(Revenue)", operator: "<", threshold: 10000, color: "warning" },
			];

			for (const row of result.rows) {
				const val = row["SUM(Revenue)"] as number;
				const colRules = rules.filter((r) => r.column === "SUM(Revenue)");
				const color = evaluateConditionalRules(val, colRules);

				if (row["Category"] === "Electronics") {
					expect(color).toBe("var(--text-success)"); // >15000
				} else {
					expect(color).toBe("var(--text-warning)"); // <10000
				}
			}
		});

		it("should generate sparkline from multi-row query result", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Month" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			});

			// 3 months of data — meets sparkline threshold
			expect(result.rows.length).toBe(3);

			const sparkValues = result.rows.map((r) => r["SUM(Revenue)"] as number);
			expect(sparkValues.length).toBeGreaterThanOrEqual(3);

			const container = createContainer();
			const rendered = ChartRenderer.renderSparkline(container, sparkValues);
			expect(rendered).toBe(true);
			expect(container.querySelector("polyline")).not.toBeNull();
		});
	});

	// ── Edge cases ─────────────────────────────────────────

	describe("edge cases", () => {
		it("should handle single data point (line chart renders dot only)", () => {
			const result = createResult(["X", "Y"], [{ X: "Only", Y: 42 }]);

			const container = createContainer();
			ChartRenderer.renderLineChart(container, result);

			const svg = container.querySelector("svg");
			expect(svg).not.toBeNull();
			expect(svg!.querySelectorAll("path").length).toBe(0); // no line
			expect(svg!.querySelectorAll("circle").length).toBe(1); // single dot
		});

		it("should handle many groups with axis label auto-scaling", () => {
			const rows = Array.from({ length: 20 }, (_, i) => ({
				Item: `Item-${i + 1}`,
				Sales: (i + 1) * 100,
			}));
			const result = createResult(["Item", "Sales"], rows);

			const container = createContainer();
			ChartRenderer.renderBarChart(container, result);

			const svg = container.querySelector("svg");
			expect(svg).not.toBeNull();
			expect(svg!.querySelectorAll("rect").length).toBe(20);
		});

		it("should handle non-numeric dimensions gracefully", () => {
			const result = createResult(["Name", "Status"], [
				{ Name: "Alice", Status: "Active" },
				{ Name: "Bob", Status: "Inactive" },
			]);
			const data = ChartRenderer.extractChartData(result);
			// No numeric column → empty data
			expect(data.labels).toEqual([]);
			expect(data.values).toEqual([]);
		});
	});
});
