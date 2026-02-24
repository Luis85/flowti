// @vitest-environment happy-dom
/**
 * Flow 35: Supplier Manager Daily Experience
 *
 * End-to-end integration test covering the supplier manager's daily workflow:
 *
 * Journey A: Daily Consumption
 * - Dashboard with tiles, tile CSV export, view source query navigation
 * - Tile management: remove, reconfigure (query change, width, sparkline)
 *
 * Journey B: Dashboard Creation
 * - Query-to-dashboard: save query → add to dashboard with auto-suggested mode
 * - Display mode suggestion logic (stat-card, line-chart, bar-chart, table)
 * - Query description field for documenting intent
 *
 * Infrastructure:
 * - CSV utilities: escapeCsvField edge cases, rowsToCsv generation
 *
 * Exercises: AnalyticsService, AnalyticsEngine, suggestDisplayMode,
 *            escapeCsvField, rowsToCsv, csvUtils
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import { AnalyticsEngine } from "../../src/domain/analytics/AnalyticsEngine";
import type { AnalyticsResult, AnalyticsState, DashboardTile } from "../../src/domain/analytics/types";
import { escapeCsvField, rowsToCsv } from "../../src/utils/csvUtils";
import { suggestDisplayMode } from "../../src/ui/analytics/QueriesTab";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SUPPLIER_HEADERS = ["month", "supplier_id", "sku", "cost", "qty"];
const SUPPLIER_ROWS: string[][] = [
	["01/2025", "SUP-A", "SKU-001", "24.50", "100"],
	["01/2025", "SUP-A", "SKU-002", "72.00", "40"],
	["01/2025", "SUP-B", "SKU-003", "3.20", "500"],
	["02/2025", "SUP-A", "SKU-001", "25.00", "120"],
	["02/2025", "SUP-A", "SKU-002", "71.50", "45"],
	["02/2025", "SUP-B", "SKU-003", "3.25", "480"],
	["03/2025", "SUP-A", "SKU-001", "25.00", "90"],
	["03/2025", "SUP-A", "SKU-002", "73.00", "50"],
	["03/2025", "SUP-B", "SKU-003", "3.10", "520"],
];

function makeQueryConfig() {
	return {
		joins: [],
		columnTypeHints: [
			{ column: "cost", type: "number" as const },
			{ column: "qty", type: "number" as const },
		],
		dimensions: [{ column: "supplier_id" }],
		measures: [
			{ column: "cost", function: "SUM" as const, label: "Total Cost" },
			{ column: "qty", function: "SUM" as const, label: "Total Qty" },
		],
	};
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 35: Supplier Manager Daily Experience", () => {
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

	// ── Journey A: Daily Consumption ────────────────────────

	describe("Journey A: Daily Consumption", () => {
		it("should load a dashboard with tiles and run queries", async () => {
			const query = await analyticsService.saveQuery(
				"Supplier Costs",
				[{ alias: "suppliers", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("Morning KPIs");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "stat-card", "Cost Overview");

			expect(tile).toBeDefined();
			expect(tile!.displayMode).toBe("stat-card");
			expect(tile!.title).toBe("Cost Overview");

			const db = analyticsService.getDashboard(dashboard.id);
			expect(db!.tiles).toHaveLength(1);
		});

		it("should generate CSV from tile result data", () => {
			const result = engine.run({
				sources: [{ alias: "s", data: { headers: SUPPLIER_HEADERS, rows: SUPPLIER_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "cost", type: "number" }, { column: "qty", type: "number" }],
				dimensions: [{ column: "supplier_id" }],
				measures: [
					{ column: "cost", function: "SUM", label: "Total Cost" },
					{ column: "qty", function: "SUM", label: "Total Qty" },
				],
			});

			const csv = rowsToCsv(result.columns, result.rows);
			const lines = csv.split("\n");
			expect(lines.length).toBe(3); // header + 2 suppliers
			expect(lines[0]).toContain("supplier_id");
			expect(lines[0]).toContain("Total Cost");
		});

		it("should remove a tile from dashboard", async () => {
			const query = await analyticsService.saveQuery(
				"Q1", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB1");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "T1");
			await analyticsService.addTile(dashboard.id, query.id, "stat-card", "T2");

			expect(analyticsService.getDashboard(dashboard.id)!.tiles).toHaveLength(2);

			await analyticsService.removeTile(dashboard.id, tile!.id);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles).toHaveLength(1);
			expect(updated!.tiles[0].title).toBe("T2");
		});

		it("should remove last tile from dashboard (empty state)", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "Only");

			await analyticsService.removeTile(dashboard.id, tile!.id);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated).toBeDefined();
			expect(updated!.tiles).toHaveLength(0);
		});

		it("should change tile query via settings", async () => {
			const q1 = await analyticsService.saveQuery(
				"Q1", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const q2 = await analyticsService.saveQuery(
				"Q2", [{ alias: "b", csvPath: "b.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, q1.id, "table", "T");

			await analyticsService.updateTile(dashboard.id, tile!.id, { queryId: q2.id } as Partial<DashboardTile>);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].queryId).toBe(q2.id);
		});

		it("should change tile width and height", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "T");

			await analyticsService.updateTile(dashboard.id, tile!.id, { width: 5 } as Partial<DashboardTile>);
			let updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].width).toBe(5);

			await analyticsService.updateTile(dashboard.id, tile!.id, { height: 4 } as Partial<DashboardTile>);
			updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].height).toBe(4);
		});

		it("should toggle sparkline on stat-card tile", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "stat-card", "T");

			await analyticsService.updateTile(dashboard.id, tile!.id, { showSparkline: false } as Partial<DashboardTile>);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].showSparkline).toBe(false);
		});
	});

	// ── Journey B: Dashboard Creation ────────────────────────

	describe("Journey B: Dashboard Creation", () => {
		it("should add query to dashboard with auto-suggested display mode", async () => {
			const query = await analyticsService.saveQuery(
				"Supplier Summary",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);

			const dashboard = await analyticsService.createDashboard("New Dashboard");

			// Run query to determine display mode
			const result = engine.run({
				sources: [{ alias: "s", data: { headers: SUPPLIER_HEADERS, rows: SUPPLIER_ROWS } }],
				...makeQueryConfig(),
			});

			const mode = suggestDisplayMode(result, false);
			const tile = await analyticsService.addTile(dashboard.id, query.id, mode, query.name);

			expect(tile).toBeDefined();
			expect(tile!.displayMode).toBe(mode);
			expect(analyticsService.getDashboard(dashboard.id)!.tiles).toHaveLength(1);
		});

		it("should suggest stat-card for small results (≤5 rows, ≤3 cols)", () => {
			const result: AnalyticsResult = {
				columns: ["supplier_id", "Total Cost"],
				rows: [
					{ supplier_id: "SUP-A", "Total Cost": 1000 },
					{ supplier_id: "SUP-B", "Total Cost": 500 },
				],
				groupCount: 2,
				sourceRowCount: 9,
			};
			expect(suggestDisplayMode(result, false)).toBe("stat-card");
		});

		it("should suggest line-chart when time bucket is present", () => {
			const result: AnalyticsResult = {
				columns: ["month", "Total Cost"],
				rows: Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}/2025`, "Total Cost": 1000 + i * 100 })),
				groupCount: 12,
				sourceRowCount: 100,
			};
			expect(suggestDisplayMode(result, true)).toBe("line-chart");
		});

		it("should suggest bar-chart for category groups (>5 rows, numeric cols, 2-12 groups)", () => {
			const result: AnalyticsResult = {
				columns: ["category", "revenue"],
				rows: Array.from({ length: 8 }, (_, i) => ({ category: `Cat-${i}`, revenue: 100 * (i + 1) })),
				groupCount: 8,
				sourceRowCount: 50,
			};
			expect(suggestDisplayMode(result, false)).toBe("bar-chart");
		});

		it("should suggest table as fallback for large ungrouped results", () => {
			const result: AnalyticsResult = {
				columns: ["id", "name", "value", "extra"],
				rows: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Item ${i}`, value: i * 10, extra: "x" })),
				groupCount: 20,
				sourceRowCount: 20,
			};
			expect(suggestDisplayMode(result, false)).toBe("table");
		});

		it("should save and retrieve query description", async () => {
			const query = await analyticsService.saveQuery(
				"Cost Analysis",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);

			expect(query.description).toBeUndefined();

			await analyticsService.updateQueryDescription(query.id, "Monthly procurement cost by supplier for budget review");

			const updated = analyticsService.getQuery(query.id);
			expect(updated!.description).toBe("Monthly procurement cost by supplier for budget review");
		});

		it("should clear query description when set to undefined", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);

			await analyticsService.updateQueryDescription(query.id, "Some description");
			expect(analyticsService.getQuery(query.id)!.description).toBe("Some description");

			await analyticsService.updateQueryDescription(query.id, undefined);
			expect(analyticsService.getQuery(query.id)!.description).toBeUndefined();
		});

		it("should preserve description through query duplication", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			await analyticsService.updateQueryDescription(query.id, "Original intent");

			const clone = await analyticsService.duplicateQuery(query.id);
			expect(clone!.description).toBe("Original intent");
		});
	});

	// ── Infrastructure: CSV Utilities ─────────────────────────

	describe("CSV utilities", () => {
		it("should escape fields with commas", () => {
			expect(escapeCsvField("hello, world")).toBe('"hello, world"');
		});

		it("should escape fields with quotes", () => {
			expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
		});

		it("should escape fields with newlines", () => {
			expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
		});

		it("should handle null and undefined", () => {
			expect(escapeCsvField(null)).toBe("");
			expect(escapeCsvField(undefined)).toBe("");
		});

		it("should handle numbers", () => {
			expect(escapeCsvField(42)).toBe("42");
			expect(escapeCsvField(0)).toBe("0");
			expect(escapeCsvField(3.14)).toBe("3.14");
		});

		it("should pass through clean strings", () => {
			expect(escapeCsvField("hello")).toBe("hello");
		});

		it("should generate valid CSV from columns and rows", () => {
			const columns = ["name", "value"];
			const rows = [
				{ name: "Alpha", value: 100 },
				{ name: "Beta, Inc.", value: 200 },
			];

			const csv = rowsToCsv(columns, rows);
			const lines = csv.split("\n");
			expect(lines).toHaveLength(3);
			expect(lines[0]).toBe("name,value");
			expect(lines[1]).toBe("Alpha,100");
			expect(lines[2]).toBe('"Beta, Inc.",200');
		});

		it("should handle empty rows", () => {
			const csv = rowsToCsv(["a", "b"], []);
			expect(csv).toBe("a,b");
		});
	});

	// ── Edge Cases ───────────────────────────────────────────

	describe("Edge cases", () => {
		it("should handle updateQueryDescription for nonexistent query", async () => {
			// Should not throw
			await analyticsService.updateQueryDescription("nonexistent", "desc");
		});

		it("should handle tile row limit", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "T");

			await analyticsService.updateTile(dashboard.id, tile!.id, { rowLimit: 5 } as Partial<DashboardTile>);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].rowLimit).toBe(5);
		});

		it("should handle tile auto-height", async () => {
			const query = await analyticsService.saveQuery(
				"Q", [{ alias: "a", csvPath: "a.csv" }],
				makeQueryConfig(),
			);
			const dashboard = await analyticsService.createDashboard("DB");
			const tile = await analyticsService.addTile(dashboard.id, query.id, "table", "T");

			await analyticsService.updateTile(dashboard.id, tile!.id, { autoHeight: true } as Partial<DashboardTile>);
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles[0].autoHeight).toBe(true);
		});

		it("should handle dashboard description", async () => {
			const dashboard = await analyticsService.createDashboard("DB", "Morning KPI dashboard");
			expect(dashboard.description).toBe("Morning KPI dashboard");

			await analyticsService.updateDashboard(dashboard.id, { description: "Updated desc" });
			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.description).toBe("Updated desc");
		});
	});
});
