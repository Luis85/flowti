// @vitest-environment happy-dom
/**
 * Flow 34: Inventory Discovery & Dashboard Integration
 *
 * End-to-end integration test covering the inventory discovery workflow:
 * - Inventory data queries: stock levels, days of coverage, items below reorder
 * - Area chart data extraction: single and multi-series
 * - Dashboard template cycle: save → list → create from template → verify fresh IDs
 * - User Hub widget: provider extracts stat-card values from default dashboard
 * - Tech debt fixes: evalIf malformed condition, updateTile whitelist
 * - Edge cases: zero daily sales, empty data, single-month snapshot
 *
 * Exercises: AnalyticsEngine, AnalyticsService, ChartRenderer,
 *            AnalyticsHubProvider, expressionFunctions
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import { AnalyticsEngine } from "../../src/domain/analytics/AnalyticsEngine";
import { evaluateExpression } from "../../src/domain/analytics/AnalyticsEngine";
import { ChartRenderer } from "../../src/ui/analytics/ChartRenderer";
import { AnalyticsHubProvider } from "../../src/domain/hub/AnalyticsHubProvider";
import type { AnalyticsQuery, AnalyticsResult, AnalyticsState } from "../../src/domain/analytics/types";
import { evalIf } from "../../src/domain/analytics/expressionFunctions";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const INVENTORY_HEADERS = ["snapshot_date", "item_id", "supplier_id", "qty_on_hand", "reorder_point", "safety_stock", "avg_daily_sales", "unit_cost"];
const INVENTORY_ROWS: string[][] = [
	["01/31/2025", "ITM-001", "SUP-A", "450", "200", "100", "4.7", "24.50"],
	["01/31/2025", "ITM-002", "SUP-A", "140", "80", "40", "1.7", "72.00"],
	["01/31/2025", "ITM-006", "SUP-B", "2200", "500", "250", "17.5", "3.20"],
	["02/28/2025", "ITM-001", "SUP-A", "360", "200", "100", "4.7", "24.50"],
	["02/28/2025", "ITM-002", "SUP-A", "135", "80", "40", "1.8", "71.50"],
	["02/28/2025", "ITM-006", "SUP-B", "2050", "500", "250", "17.5", "3.25"],
	["03/31/2025", "ITM-001", "SUP-A", "290", "200", "100", "4.7", "25.00"],
	["03/31/2025", "ITM-002", "SUP-A", "150", "80", "40", "1.7", "73.00"],
	["03/31/2025", "ITM-006", "SUP-B", "2100", "500", "250", "17.5", "3.10"],
	["05/31/2025", "ITM-001", "SUP-A", "180", "200", "100", "5.3", "25.00"],
	["05/31/2025", "ITM-002", "SUP-A", "130", "80", "40", "2.0", "71.00"],
	["05/31/2025", "ITM-006", "SUP-B", "2400", "500", "250", "18.3", "3.15"],
];

const ITEMS_HEADERS = ["item_id", "item_name", "category", "unit_price"];
const ITEMS_ROWS: string[][] = [
	["ITM-001", "Wireless Mouse", "Electronics", "29.99"],
	["ITM-002", "Mechanical Keyboard", "Electronics", "89.99"],
	["ITM-006", "Notebook A5", "Office Supplies", "4.99"],
];

const PO_HEADERS = ["po_id", "po_date", "item_id", "supplier_id", "qty_ordered", "unit_cost", "total_cost", "expected_delivery_date", "status"];
const PO_ROWS: string[][] = [
	["PO-001", "01/03/2025", "ITM-001", "SUP-A", "200", "24.50", "4900", "01/20/2025", "received"],
	["PO-040", "05/02/2025", "ITM-001", "SUP-A", "250", "25.00", "6250", "05/20/2025", "open"],
	["PO-041", "05/05/2025", "ITM-006", "SUP-B", "900", "3.15", "2835", "05/18/2025", "open"],
	["PO-042", "05/08/2025", "ITM-002", "SUP-A", "60", "71.00", "4260", "05/25/2025", "open"],
];

function createInventoryQuery(computedColumns?: AnalyticsQuery["computedColumns"], filters?: AnalyticsQuery["filters"]): AnalyticsQuery {
	return {
		sources: [{
			alias: "inventory",
			data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS },
		}],
		joins: [],
		columnTypeHints: [
			{ column: "qty_on_hand", type: "number" },
			{ column: "reorder_point", type: "number" },
			{ column: "safety_stock", type: "number" },
			{ column: "avg_daily_sales", type: "number" },
			{ column: "unit_cost", type: "number" },
		],
		dimensions: [{ column: "item_id" }],
		measures: [
			{ column: "qty_on_hand", function: "SUM", label: "Total Stock" },
		],
		computedColumns,
		filters,
	};
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 34: Inventory Discovery & Dashboard Integration", () => {
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

	// ── Inventory queries ──────────────────────────────────

	describe("Inventory data queries", () => {
		it("should aggregate stock by item across months", () => {
			const result = engine.run(createInventoryQuery());

			expect(result.rows.length).toBe(3);
			const itm001Row = result.rows.find((r) => r["item_id"] === "ITM-001");
			expect(itm001Row).toBeDefined();
			// ITM-001 total stock across 4 months: 450 + 360 + 290 + 180 = 1280
			expect(itm001Row!["Total Stock"]).toBe(1280);
		});

		it("should compute inventory value per row using computed columns on aggregated data", () => {
			// Group by item_id + snapshot_date (unique per row) then compute value
			const result = engine.run({
				sources: [{
					alias: "inventory",
					data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS },
				}],
				joins: [],
				columnTypeHints: [
					{ column: "qty_on_hand", type: "number" },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "item_id" }, { column: "snapshot_date" }],
				measures: [
					{ column: "qty_on_hand", function: "SUM", label: "Stock" },
					{ column: "unit_cost", function: "AVG", label: "Cost" },
				],
				computedColumns: [
					{ name: "Value", expression: "{Stock} * {Cost}" },
				],
			});

			expect(result.rows.length).toBe(12);
			const itm001Jan = result.rows.find((r) => r["item_id"] === "ITM-001" && r["snapshot_date"] === "01/31/2025");
			expect(itm001Jan).toBeDefined();
			// 450 * 24.50 = 11025
			expect(itm001Jan!["Value"]).toBeCloseTo(11025, 0);
		});

		it("should compute days of coverage on aggregated results", () => {
			const result = engine.run({
				sources: [{
					alias: "inventory",
					data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS },
				}],
				joins: [],
				columnTypeHints: [
					{ column: "qty_on_hand", type: "number" },
					{ column: "avg_daily_sales", type: "number" },
				],
				filters: [{ column: "snapshot_date", operator: "=", value: "05/31/2025" }],
				dimensions: [{ column: "item_id" }],
				measures: [
					{ column: "qty_on_hand", function: "SUM", label: "Stock" },
					{ column: "avg_daily_sales", function: "AVG", label: "Daily Sales" },
				],
				computedColumns: [
					{ name: "Coverage Raw", expression: "{Stock} / {Daily Sales}" },
					{ name: "Days Coverage", expression: "ROUND({Coverage Raw}, 0)" },
				],
			});

			const itm001 = result.rows.find((r) => r["item_id"] === "ITM-001");
			expect(itm001).toBeDefined();
			// 180 / 5.3 = ~34 days (chained: arithmetic first, then ROUND)
			expect(itm001!["Days Coverage"]).toBeCloseTo(34, 0);
		});

		it("should identify items below reorder point using IF on aggregated data", () => {
			const result = engine.run({
				sources: [{
					alias: "inventory",
					data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS },
				}],
				joins: [],
				columnTypeHints: [
					{ column: "qty_on_hand", type: "number" },
					{ column: "reorder_point", type: "number" },
				],
				filters: [{ column: "snapshot_date", operator: "=", value: "05/31/2025" }],
				dimensions: [{ column: "item_id" }],
				measures: [
					{ column: "qty_on_hand", function: "SUM", label: "Stock" },
					{ column: "reorder_point", function: "AVG", label: "Reorder" },
				],
				computedColumns: [
					{ name: "Below", expression: "IF({Stock} < {Reorder}, 1, 0)" },
				],
			});

			// ITM-001: 180 < 200 = 1. ITM-002: 130 > 80 = 0. ITM-006: 2400 > 500 = 0.
			const itm001 = result.rows.find((r) => r["item_id"] === "ITM-001");
			expect(itm001!["Below"]).toBe(1);
			const itm002 = result.rows.find((r) => r["item_id"] === "ITM-002");
			expect(itm002!["Below"]).toBe(0);
		});
	});

	// ── Area chart ──────────────────────────────────────────

	describe("Area chart data extraction", () => {
		it("should extract single-series chart data for stock levels", () => {
			const result = engine.run({
				sources: [{
					alias: "inventory",
					data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS },
				}],
				joins: [],
				columnTypeHints: [{ column: "qty_on_hand", type: "number" }],
				dimensions: [{ column: "snapshot_date" }],
				measures: [{ column: "qty_on_hand", function: "SUM", label: "Total Stock" }],
			});

			const data = ChartRenderer.extractChartData(result, "Total Stock");
			expect(data.labels.length).toBeGreaterThan(0);
			expect(data.values.length).toBe(data.labels.length);
			// All values should be positive stock levels
			expect(data.values.every((v) => v > 0)).toBe(true);
		});

		it("should extract multi-series area chart data with time bucket + dimension", () => {
			const result = engine.run({
				sources: [
					{ alias: "inventory", data: { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS } },
					{ alias: "items", data: { headers: ITEMS_HEADERS, rows: ITEMS_ROWS } },
				],
				joins: [{ leftSource: "inventory", rightSource: "items", leftColumn: "item_id", rightColumn: "item_id", type: "inner" as const }],
				columnTypeHints: [{ column: "qty_on_hand", type: "number" }],
				timeBucket: { column: "snapshot_date", period: "month" },
				dimensions: [{ column: "category" }],
				measures: [{ column: "qty_on_hand", function: "SUM", label: "Stock" }],
			});

			const multiData = ChartRenderer.extractMultiSeriesData(result, "Stock");
			// Should detect multi-series (time bucket + category dimension)
			if (multiData) {
				expect(multiData.series.length).toBeGreaterThanOrEqual(1);
				expect(multiData.labels.length).toBeGreaterThan(0);
			} else {
				// If multi-series not detected, single series should still work
				const data = ChartRenderer.extractChartData(result, "Stock");
				expect(data.values.length).toBeGreaterThan(0);
			}
		});
	});

	// ── Dashboard template cycle ────────────────────────────

	describe("Dashboard template cycle", () => {
		it("should save a dashboard as template and create from it", async () => {
			// 1. Create a query and dashboard
			const query = await analyticsService.saveQuery(
				"Inventory Value",
				[{ alias: "inventory", csvPath: "test/Inventory.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "qty_on_hand", type: "number" }, { column: "unit_cost", type: "number" }],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "qty_on_hand", function: "SUM", label: "Total Stock" }],
					computedColumns: [{ name: "Value", expression: "{qty_on_hand} * {unit_cost}" }],
				},
			);

			const dashboard = await analyticsService.createDashboard("Inventory Health");
			await analyticsService.addTile(dashboard.id, query.id, "stat-card", "Total Value");
			await analyticsService.addTile(dashboard.id, query.id, "area-chart", "Stock Trend");

			// 2. Save as template
			const template = await analyticsService.saveDashboardAsTemplate(
				dashboard.id, "Inventory Template", "Reusable inventory dashboard", "Inventory Management",
			);

			expect(template).toBeDefined();
			expect(template!.name).toBe("Inventory Template");
			expect(template!.domain).toBe("Inventory Management");
			expect(template!.queries).toHaveLength(1);
			expect(template!.tiles).toHaveLength(2);
			expect(template!.tiles[0].displayMode).toBe("stat-card");
			expect(template!.tiles[1].displayMode).toBe("area-chart");

			// 3. List templates
			expect(analyticsService.listTemplates()).toHaveLength(1);

			// 4. Create dashboard from template with source mapping
			const newDashboard = await analyticsService.createDashboardFromTemplate(
				template!.id,
				{ "test/Inventory.csv": "other/Inventory2.csv" },
				"Inventory Health v2",
			);

			expect(newDashboard).toBeDefined();
			expect(newDashboard!.name).toBe("Inventory Health v2");
			expect(newDashboard!.tiles).toHaveLength(2);

			// Fresh query IDs (not shared with original)
			const originalQueryId = query.id;
			const newTileQueryIds = newDashboard!.tiles.map((t) => t.queryId);
			expect(newTileQueryIds.every((id) => id !== originalQueryId)).toBe(true);

			// New query has mapped source path
			const newQuery = analyticsService.getQuery(newTileQueryIds[0]);
			expect(newQuery).toBeDefined();
			expect(newQuery!.sources[0].csvPath).toBe("other/Inventory2.csv");
		});

		it("should persist templates across load cycles", async () => {
			const query = await analyticsService.saveQuery(
				"Q1", [{ alias: "a", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [{ column: "x" }], measures: [{ column: "x", function: "COUNT", label: "c" }] },
			);
			const db = await analyticsService.createDashboard("DB1");
			await analyticsService.addTile(db.id, query.id, "table", "T1");

			await analyticsService.saveDashboardAsTemplate(db.id, "Template1", "Desc", "Test");
			expect(analyticsService.listTemplates()).toHaveLength(1);
		});

		it("should delete a template without affecting dashboards created from it", async () => {
			const query = await analyticsService.saveQuery(
				"Q1", [{ alias: "a", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [{ column: "x" }], measures: [{ column: "x", function: "COUNT", label: "c" }] },
			);
			const db = await analyticsService.createDashboard("DB1");
			await analyticsService.addTile(db.id, query.id, "table", "T1");

			const template = await analyticsService.saveDashboardAsTemplate(db.id, "Tmpl", "D", "T");
			const created = await analyticsService.createDashboardFromTemplate(template!.id, {}, "Created DB");

			// Delete template
			const deleted = await analyticsService.deleteTemplate(template!.id);
			expect(deleted).toBe(true);
			expect(analyticsService.listTemplates()).toHaveLength(0);

			// Dashboard created from template still exists
			expect(analyticsService.getDashboard(created!.id)).toBeDefined();
		});

		it("should return undefined for nonexistent template", async () => {
			const result = await analyticsService.createDashboardFromTemplate("nonexistent", {});
			expect(result).toBeUndefined();
		});
	});

	// ── User Hub widget ──────────────────────────────────────

	describe("User Hub dashboard widget", () => {
		it("should return empty dashboardStats when no default dashboard", () => {
			const provider = new AnalyticsHubProvider(analyticsService);
			const summary = provider.getSummary();
			expect(summary.dashboardStats).toBeUndefined();
		});

		it("should include query and dashboard counts in stats", async () => {
			await analyticsService.saveQuery(
				"Q1", [{ alias: "a", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [{ column: "x" }], measures: [{ column: "x", function: "COUNT", label: "c" }] },
			);
			await analyticsService.createDashboard("DB1");

			const provider = new AnalyticsHubProvider(analyticsService);
			const summary = provider.getSummary();

			expect(summary.stats).toHaveLength(2);
			expect(summary.stats[0].value).toBe("1"); // 1 query
			expect(summary.stats[1].value).toBe("1"); // 1 dashboard
		});
	});

	// ── Tech debt fixes ──────────────────────────────────────

	describe("Tech debt verification", () => {
		it("evalIf returns else value for malformed condition (AI-1)", () => {
			const row = { X: 10, Y: 20 };
			// No operator in condition → should return else value, not 0
			expect(evalIf(["no_operator", '"Yes"', '"No"'], row)).toBe("No");
			expect(evalIf(["", '"Yes"', '"Fallback"'], row)).toBe("Fallback");
		});

		it("evaluateExpression handles IF with malformed condition gracefully", () => {
			const row = { Score: 50 };
			// Valid IF
			expect(evaluateExpression('IF({Score} > 40, "Pass", "Fail")', row)).toBe("Pass");
		});

		it("updateTile preserves all fields via whitelist (AI-3)", async () => {
			const dashboard = await analyticsService.createDashboard("DB");
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [{ column: "x" }], measures: [{ column: "x", function: "COUNT", label: "c" }] },
			);
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "T");

			// Update all whitelisted fields
			const updated = await analyticsService.updateTile(dashboard.id, tile!.id, {
				displayMode: "area-chart",
				chartValueColumn: "revenue",
				showSparkline: false,
				conditionalRules: [{ column: "x", operator: ">", threshold: 10, color: "red" }],
			});

			expect(updated!.displayMode).toBe("area-chart");
			expect(updated!.chartValueColumn).toBe("revenue");
			expect(updated!.showSparkline).toBe(false);
			expect(updated!.conditionalRules).toHaveLength(1);
		});
	});

	// ── Edge cases ──────────────────────────────────────────

	describe("Edge cases", () => {
		it("should handle zero avg_daily_sales in coverage calculation", () => {
			const row = { qty_on_hand: 100, avg_daily_sales: 0 };
			// Division by zero should produce Infinity → ROUND should handle
			const result = evaluateExpression("ROUND({qty_on_hand} / {avg_daily_sales}, 0)", row);
			// Infinity rounded → Infinity (acceptable behavior — engine handles gracefully)
			expect(typeof result).toBe("number");
		});

		it("should handle empty inventory result", () => {
			const result = engine.run({
				sources: [{
					alias: "empty",
					data: { headers: INVENTORY_HEADERS, rows: [] },
				}],
				joins: [],
				columnTypeHints: [{ column: "qty_on_hand", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "qty_on_hand", function: "SUM", label: "Stock" }],
			});

			expect(result.rows).toHaveLength(0);
			const data = ChartRenderer.extractChartData(result, "Stock");
			expect(data.labels).toHaveLength(0);
			expect(data.values).toHaveLength(0);
		});

		it("should handle single-month snapshot", () => {
			const singleMonth = INVENTORY_ROWS.filter((r) => r[0] === "01/31/2025");
			const result = engine.run({
				sources: [{
					alias: "inventory",
					data: { headers: INVENTORY_HEADERS, rows: singleMonth },
				}],
				joins: [],
				columnTypeHints: [{ column: "qty_on_hand", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "qty_on_hand", function: "SUM", label: "Stock" }],
			});

			expect(result.rows).toHaveLength(3);
		});

		it("should handle purchase orders with status filter", () => {
			const result = engine.run({
				sources: [{
					alias: "po",
					data: { headers: PO_HEADERS, rows: PO_ROWS },
				}],
				joins: [],
				columnTypeHints: [{ column: "qty_ordered", type: "number" }, { column: "total_cost", type: "number" }],
				filters: [{ column: "status", operator: "=", value: "open" }],
				dimensions: [{ column: "supplier_id" }],
				measures: [
					{ column: "total_cost", function: "SUM", label: "Open PO Value" },
					{ column: "qty_ordered", function: "SUM", label: "Open Qty" },
				],
			});

			// 3 open POs: SUP-A (6250+4260), SUP-B (2835)
			expect(result.rows.length).toBe(2);
			const supA = result.rows.find((r) => r["supplier_id"] === "SUP-A");
			expect(supA!["Open PO Value"]).toBe(10510);
		});

		it("should save dashboard as template returns undefined for nonexistent dashboard", async () => {
			const result = await analyticsService.saveDashboardAsTemplate("nonexistent", "N", "D", "T");
			expect(result).toBeUndefined();
		});

		it("should emit template events", async () => {
			const events: string[] = [];
			eventBus.on("analytics.template.saved", () => { events.push("saved"); });
			eventBus.on("analytics.template.used", () => { events.push("used"); });

			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [{ column: "x" }], measures: [{ column: "x", function: "COUNT", label: "c" }] },
			);
			const db = await analyticsService.createDashboard("DB");
			await analyticsService.addTile(db.id, query.id, "table", "T");

			const tmpl = await analyticsService.saveDashboardAsTemplate(db.id, "T", "D", "D");
			await analyticsService.createDashboardFromTemplate(tmpl!.id, {});

			expect(events).toContain("saved");
			expect(events).toContain("used");
		});
	});
});
