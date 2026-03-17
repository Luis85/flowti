// @vitest-environment happy-dom
/**
 * Flow 37: CSV Analytics Cross-Domain Integration
 *
 * End-to-end integration test covering CSV-to-Analytics discovery:
 *
 * Journey A: Dashboard Transparency
 * - getQueriesBySource returns matching queries by CSV path
 * - getDashboardQueryMap returns unique queries per dashboard with tile counts
 * - getSourceBasenames extracts file names from query sources
 *
 * Journey B: CSV Analytics Discovery
 * - CsvAnalyticsSection builds auto-summary from measures/dimensions
 * - CsvAnalyticsSection shows description when available
 * - Empty state when no queries reference a CSV
 *
 * Journey C: Source Pre-Selection
 * - suggestDisplayMode auto-detects display mode from result shape
 * - Related queries discovered from active sources
 *
 * Exercises: AnalyticsService.getQueriesBySource, AnalyticsService.getDashboardQueryMap,
 *            getSourceBasenames, CsvAnalyticsSection, suggestDisplayMode
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState, SavedAnalyticsQuery } from "../../src/domain/analytics/types";
import { getSourceBasenames } from "../../src/ui/analytics/DashboardQueryMap";
import { CsvAnalyticsSection } from "../../src/ui/csv/CsvAnalyticsSection";
import type { CsvComponentDeps } from "../../src/ui/csv/types";
import { suggestDisplayMode } from "../../src/ui/analytics/queries/ActionsBar";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

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

function makeCsvDeps(overrides: Partial<CsvComponentDeps>): CsvComponentDeps {
	return overrides as CsvComponentDeps;
}

function makeMockFile(path: string) {
	const parts = path.split("/");
	const basename = parts[parts.length - 1];
	const ext = basename.split(".").pop() ?? "";
	return { path, basename, extension: ext };
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 37: CSV Analytics Cross-Domain Integration", () => {
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

	// ── Journey A: Dashboard Transparency ────────────────────

	describe("Journey A: Dashboard Transparency", () => {
		it("should return queries by CSV source path", async () => {
			await analyticsService.saveQuery(
				"Q1",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);
			await analyticsService.saveQuery(
				"Q2",
				[{ alias: "s", csvPath: "data/Orders.csv" }],
				makeQueryConfig(),
			);

			const supplierQueries = analyticsService.getQueriesBySource("data/Suppliers.csv");
			expect(supplierQueries).toHaveLength(1);
			expect(supplierQueries[0].name).toBe("Q1");
		});

		it("should return empty array when no queries match source", async () => {
			await analyticsService.saveQuery(
				"Q1",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);

			const result = analyticsService.getQueriesBySource("data/Unknown.csv");
			expect(result).toHaveLength(0);
		});

		it("should match queries with multiple sources", async () => {
			await analyticsService.saveQuery(
				"Multi-Source",
				[
					{ alias: "a", csvPath: "data/Suppliers.csv" },
					{ alias: "b", csvPath: "data/Orders.csv" },
				],
				makeQueryConfig(),
			);

			const supplierQueries = analyticsService.getQueriesBySource("data/Suppliers.csv");
			expect(supplierQueries).toHaveLength(1);
			expect(supplierQueries[0].name).toBe("Multi-Source");

			const orderQueries = analyticsService.getQueriesBySource("data/Orders.csv");
			expect(orderQueries).toHaveLength(1);
			expect(orderQueries[0].name).toBe("Multi-Source");
		});

		it("should build dashboard query map with tile counts", async () => {
			const q1 = await analyticsService.saveQuery(
				"Q1",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);
			const q2 = await analyticsService.saveQuery(
				"Q2",
				[{ alias: "s", csvPath: "data/Orders.csv" }],
				makeQueryConfig(),
			);

			const dashboard = await analyticsService.createDashboard("My Dashboard");
			await analyticsService.addTile(dashboard.id, q1.id, "table", "Tile 1");
			await analyticsService.addTile(dashboard.id, q1.id, "stat-card", "Tile 2");
			await analyticsService.addTile(dashboard.id, q2.id, "table", "Tile 3");

			const map = analyticsService.getDashboardQueryMap(dashboard.id);
			expect(map.size).toBe(2);

			const q1Entry = map.get(q1.id);
			expect(q1Entry).toBeDefined();
			expect(q1Entry!.tileCount).toBe(2);
			expect(q1Entry!.query.name).toBe("Q1");

			const q2Entry = map.get(q2.id);
			expect(q2Entry).toBeDefined();
			expect(q2Entry!.tileCount).toBe(1);
		});

		it("should return empty map for non-existent dashboard", () => {
			const map = analyticsService.getDashboardQueryMap("nonexistent");
			expect(map.size).toBe(0);
		});

		it("should return empty map for dashboard with no tiles", async () => {
			const dashboard = await analyticsService.createDashboard("Empty");
			const map = analyticsService.getDashboardQueryMap(dashboard.id);
			expect(map.size).toBe(0);
		});

		it("should extract source basenames from query", async () => {
			const query = await analyticsService.saveQuery(
				"Q1",
				[
					{ alias: "a", csvPath: "data/folder/Suppliers.csv" },
					{ alias: "b", csvPath: "reports/Orders.csv" },
				],
				makeQueryConfig(),
			);

			const basenames = getSourceBasenames(query);
			expect(basenames).toEqual(["Suppliers.csv", "Orders.csv"]);
		});

		it("should return empty basenames for query with no sources", () => {
			const fakeQuery = { sources: [] } as unknown as SavedAnalyticsQuery;
			const basenames = getSourceBasenames(fakeQuery);
			expect(basenames).toEqual([]);
		});

		it("should return empty basenames for query with undefined sources", () => {
			const fakeQuery = {} as unknown as SavedAnalyticsQuery;
			const basenames = getSourceBasenames(fakeQuery);
			expect(basenames).toEqual([]);
		});
	});

	// ── Journey B: CSV Analytics Discovery ────────────────────

	describe("Journey B: CSV Analytics Discovery", () => {
		it("should render analytics section with matching queries", async () => {
			await analyticsService.saveQuery(
				"Supplier Analysis",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);

			const container = document.createElement("div");
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("data/Suppliers.csv") as any,
				getQueriesBySource: (p: string) => analyticsService.getQueriesBySource(p),
			}));

			section.render(container);

			expect(container.textContent).toContain("Analytics");
			expect(container.textContent).toContain("Supplier Analysis");
		});

		it("should build auto-summary from measures and dimensions", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("a.csv") as any,
				getQueriesBySource: () => [{
					id: "q1",
					name: "Q1",
					sources: [{ alias: "s", csvPath: "a.csv" }],
					measures: [{ column: "cost", function: "SUM" as const, label: "Total Cost" }],
					dimensions: [{ column: "supplier_id" }],
					joins: [],
					columnTypeHints: [],
					createdAt: new Date().toISOString(),
				}] as unknown as SavedAnalyticsQuery[],
			}));

			const container = document.createElement("div");
			section.render(container);

			// Auto-summary should show "SUM(cost) by supplier_id"
			expect(container.textContent).toContain("SUM(cost)");
			expect(container.textContent).toContain("by supplier_id");
		});

		it("should show description when available instead of auto-summary", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("a.csv") as any,
				getQueriesBySource: () => [{
					id: "q1",
					name: "Q1",
					description: "Monthly supplier cost analysis",
					sources: [{ alias: "s", csvPath: "a.csv" }],
					measures: [{ column: "cost", function: "SUM" as const, label: "Total Cost" }],
					dimensions: [{ column: "supplier_id" }],
					joins: [],
					columnTypeHints: [],
					createdAt: new Date().toISOString(),
				}] as unknown as SavedAnalyticsQuery[],
			}));

			const container = document.createElement("div");
			section.render(container);

			expect(container.textContent).toContain("Monthly supplier cost analysis");
			// Should NOT show auto-summary when description is present
			expect(container.textContent).not.toContain("SUM(cost)");
		});

		it("should render empty state when no queries reference file", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("a.csv") as any,
				getQueriesBySource: () => [],
			}));

			const container = document.createElement("div");
			section.render(container);

			expect(container.textContent).toContain("No analytics queries reference this file yet");
		});

		it("should not render when getFile returns null", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => null as any,
				getQueriesBySource: () => [],
			}));

			const container = document.createElement("div");
			section.render(container);

			expect(container.innerHTML).toBe("");
		});

		it("should not render when getQueriesBySource is not provided", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("a.csv") as any,
			}));

			const container = document.createElement("div");
			section.render(container);

			expect(container.innerHTML).toBe("");
		});

		it("should render Create Query button in empty state when openAnalyticsHub is available", () => {
			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("data/test.csv") as any,
				getQueriesBySource: () => [],
				openAnalyticsHub: () => {},
			}));

			const container = document.createElement("div");
			section.render(container);

			expect(container.textContent).toContain("Create Query");
		});
	});

	// ── Journey C: Source Pre-Selection ───────────────────────

	describe("Journey C: Source Pre-Selection", () => {
		it("should suggest stat-card display mode for small results", () => {
			const result = {
				columns: ["supplier_id", "Total Cost"],
				rows: [{ supplier_id: "SUP-A", "Total Cost": 291 }],
				groupCount: 1,
				sourceRowCount: 1,
			};
			expect(suggestDisplayMode(result, false)).toBe("stat-card");
		});

		it("should suggest line-chart for time bucket queries", () => {
			const result = {
				columns: ["month", "Total Cost"],
				rows: [
					{ month: "01/2025", "Total Cost": 100 },
					{ month: "02/2025", "Total Cost": 120 },
					{ month: "03/2025", "Total Cost": 90 },
				],
				groupCount: 3,
				sourceRowCount: 3,
			};
			expect(suggestDisplayMode(result, true)).toBe("line-chart");
		});

		it("should suggest table for large results", () => {
			const rows = Array.from({ length: 20 }, (_, i) => ({
				supplier_id: `SUP-${i}`,
				"Total Cost": i * 10,
			}));
			const result = {
				columns: ["supplier_id", "Total Cost"],
				rows,
				groupCount: 20,
				sourceRowCount: 20,
			};
			expect(suggestDisplayMode(result, false)).toBe("table");
		});

		it("should suggest bar-chart for moderate category groups", () => {
			const rows = Array.from({ length: 8 }, (_, i) => ({
				category: `Cat-${i}`,
				amount: i * 10,
			}));
			const result = {
				columns: ["category", "amount"],
				rows,
				groupCount: 8,
				sourceRowCount: 8,
			};
			expect(suggestDisplayMode(result, false)).toBe("bar-chart");
		});

		it("should identify queries sharing sources via getQueriesBySource", async () => {
			await analyticsService.saveQuery(
				"Query A",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);
			await analyticsService.saveQuery(
				"Query B",
				[{ alias: "s", csvPath: "data/Suppliers.csv" }],
				makeQueryConfig(),
			);
			await analyticsService.saveQuery(
				"Query C",
				[{ alias: "s", csvPath: "data/Orders.csv" }],
				makeQueryConfig(),
			);

			const related = analyticsService.getQueriesBySource("data/Suppliers.csv");
			expect(related).toHaveLength(2);
			expect(related.map((q) => q.name).sort()).toEqual(["Query A", "Query B"]);
		});
	});

	// ── Edge Cases ───────────────────────────────────────────

	describe("Edge cases", () => {
		it("should handle dashboard query map when query is deleted after tile creation", async () => {
			const q = await analyticsService.saveQuery(
				"Temp",
				[{ alias: "s", csvPath: "a.csv" }],
				makeQueryConfig(),
			);

			const dashboard = await analyticsService.createDashboard("D");
			await analyticsService.addTile(dashboard.id, q.id, "table", "T");

			// Delete the query
			await analyticsService.deleteQuery(q.id);

			// Map should not include the deleted query
			const map = analyticsService.getDashboardQueryMap(dashboard.id);
			expect(map.size).toBe(0);
		});

		it("should handle getQueriesBySource with path containing special characters", async () => {
			await analyticsService.saveQuery(
				"Special",
				[{ alias: "s", csvPath: "data/my file (copy).csv" }],
				makeQueryConfig(),
			);

			const result = analyticsService.getQueriesBySource("data/my file (copy).csv");
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Special");
		});

		it("should handle getSourceBasenames with deep paths", () => {
			const fakeQuery = {
				sources: [{ csvPath: "a/b/c/d/e/deep.csv" }],
			} as unknown as SavedAnalyticsQuery;
			expect(getSourceBasenames(fakeQuery)).toEqual(["deep.csv"]);
		});

		it("should handle getSourceBasenames with root-level file", () => {
			const fakeQuery = {
				sources: [{ csvPath: "data.csv" }],
			} as unknown as SavedAnalyticsQuery;
			expect(getSourceBasenames(fakeQuery)).toEqual(["data.csv"]);
		});

		it("should handle CsvAnalyticsSection with multiple queries", async () => {
			for (let i = 0; i < 5; i++) {
				await analyticsService.saveQuery(
					`Query ${i}`,
					[{ alias: "s", csvPath: "data/multi.csv" }],
					{ ...makeQueryConfig(), dimensions: [{ column: `dim_${i}` }] },
				);
			}

			const section = new CsvAnalyticsSection(makeCsvDeps({
				getFile: () => makeMockFile("data/multi.csv") as any,
				getQueriesBySource: (p: string) => analyticsService.getQueriesBySource(p),
			}));

			const container = document.createElement("div");
			section.render(container);

			// All 5 query names should appear
			for (let i = 0; i < 5; i++) {
				expect(container.textContent).toContain(`Query ${i}`);
			}
		});
	});
});
