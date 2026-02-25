/**
 * Flow 30: Analytics Hub — UX Mastery
 *
 * End-to-end integration test covering power-user analytics workflows:
 * - Query with filters (WHERE clause)
 * - Query sort + limit (ORDER BY + LIMIT)
 * - Query rename and duplicate
 * - Tile reorder within a dashboard
 * - Dashboard rename and description editing
 * - Multi-row stat-card verification
 * - New event emission (renamed, duplicated, tile.reordered)
 *
 * Event sequence:
 *   analytics.loaded → analytics.query.saved → analytics.dashboard.created →
 *   analytics.query.renamed → analytics.query.duplicated →
 *   analytics.dashboard.tile.reordered
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { createMockStorage, collectEvents } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["Category", "Product", "Amount", "Quantity"];
const SALES_ROWS: string[][] = [
	["Electronics", "Phone", "500", "10"],
	["Books", "Novel", "150", "25"],
	["Electronics", "Laptop", "1200", "5"],
	["Books", "Textbook", "80", "15"],
	["Clothing", "Shirt", "30", "100"],
	["Electronics", "Tablet", "300", "8"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 30: Analytics UX Mastery", () => {
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
		analyticsService.setReadCsv(async (csvPath: string) => {
			if (csvPath === "data/sales.csv") {
				return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
			}
			return null;
		});
	});

	// ── Query with filters ──────────────────────────────────

	describe("query filters", () => {
		it("should filter rows with equals operator", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
				filters: [{ column: "Category", operator: "=", value: "Electronics" }],
			});

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]["Category"]).toBe("Electronics");
			expect(result.rows[0]["SUM(Amount)"]).toBe(2000);
		});

		it("should filter rows with not-equals operator", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
				filters: [{ column: "Category", operator: "!=", value: "Electronics" }],
			});

			expect(result.rows).toHaveLength(2); // Books + Clothing
			const categories = result.rows.map((r) => r["Category"]);
			expect(categories).toContain("Books");
			expect(categories).toContain("Clothing");
		});

		it("should filter with numeric greater-than operator", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				filters: [{ column: "Amount", operator: ">", value: "300" }],
			});

			// Only Phone (500) and Laptop (1200) pass the filter
			expect(result.rows).toHaveLength(2);
			const products = result.rows.map((r) => r["Product"]);
			expect(products).toContain("Phone");
			expect(products).toContain("Laptop");
		});

		it("should filter with contains operator", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "COUNT" }],
				filters: [{ column: "Product", operator: "contains", value: "book" }],
			});

			// "Textbook" contains "book" (case-insensitive)
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]["Product"]).toBe("Textbook");
		});

		it("should apply multiple filters (AND logic)", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				filters: [
					{ column: "Category", operator: "=", value: "Electronics" },
					{ column: "Amount", operator: ">=", value: "500" },
				],
			});

			// Electronics with Amount >= 500: Phone (500), Laptop (1200)
			expect(result.rows).toHaveLength(2);
		});
	});

	// ── Sort and limit ──────────────────────────────────────

	describe("query sort and limit", () => {
		it("should sort results by column ascending", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				sort: [{ column: "SUM(Amount)", direction: "asc" }],
			});

			const amounts = result.rows.map((r) => r["SUM(Amount)"] as number);
			for (let i = 1; i < amounts.length; i++) {
				expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
			}
		});

		it("should sort results by column descending", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				sort: [{ column: "SUM(Amount)", direction: "desc" }],
			});

			const amounts = result.rows.map((r) => r["SUM(Amount)"] as number);
			for (let i = 1; i < amounts.length; i++) {
				expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
			}
		});

		it("should limit result row count", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				sort: [{ column: "SUM(Amount)", direction: "desc" }],
				limit: 2,
			});

			expect(result.rows).toHaveLength(2);
			// Top 2 by amount descending: Laptop (1200), Phone (500)
			expect(result.rows[0]["Product"]).toBe("Laptop");
			expect(result.rows[1]["Product"]).toBe("Phone");
		});

		it("should combine filters, sort, and limit", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Amount", function: "SUM" }],
				filters: [{ column: "Category", operator: "!=", value: "Clothing" }],
				sort: [{ column: "SUM(Amount)", direction: "desc" }],
				limit: 3,
			});

			// 5 non-Clothing products → sort desc → top 3
			expect(result.rows).toHaveLength(3);
			expect(result.rows[0]["Product"]).toBe("Laptop");
		});
	});

	// ── Query rename and duplicate ──────────────────────────

	describe("query rename and duplicate", () => {
		it("should rename a saved query", async () => {
			const saved = await analyticsService.saveQuery(
				"Old Name", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			const renamed = await analyticsService.renameQuery(saved.id, "New Name");
			expect(renamed).toBeDefined();
			expect(renamed!.name).toBe("New Name");

			const fetched = analyticsService.getQuery(saved.id);
			expect(fetched!.name).toBe("New Name");
		});

		it("should emit analytics.query.renamed event", async () => {
			const events = collectEvents(eventBus, "*");
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			await analyticsService.renameQuery(saved.id, "Q Renamed");
			expect(events).toContain("analytics.query.renamed");
		});

		it("should reject empty rename", async () => {
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			const result = await analyticsService.renameQuery(saved.id, "  ");
			expect(result).toBeUndefined();
			expect(analyticsService.getQuery(saved.id)!.name).toBe("Q");
		});

		it("should duplicate a saved query", async () => {
			const saved = await analyticsService.saveQuery(
				"Original", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [{ column: "Amount", type: "number" }], dimensions: [{ column: "Category" }], measures: [{ column: "Amount", function: "SUM" }] },
			);

			const clone = await analyticsService.duplicateQuery(saved.id);
			expect(clone).toBeDefined();
			expect(clone!.name).toBe("Original (copy)");
			expect(clone!.id).not.toBe(saved.id);
			expect(clone!.dimensions).toHaveLength(1);
			expect(clone!.measures).toHaveLength(1);
			expect(analyticsService.listQueries()).toHaveLength(2);
		});

		it("should emit analytics.query.duplicated event", async () => {
			const events = collectEvents(eventBus, "*");
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			await analyticsService.duplicateQuery(saved.id);
			expect(events).toContain("analytics.query.duplicated");
		});
	});

	// ── Tile reorder ────────────────────────────────────────

	describe("tile reorder", () => {
		it("should reorder tiles within a dashboard", async () => {
			const saved1 = await analyticsService.saveQuery(
				"Q1", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			const saved2 = await analyticsService.saveQuery(
				"Q2", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Quantity", function: "SUM" }] },
			);

			const dashboard = await analyticsService.createDashboard("Reorder Test");
			const tile1 = await analyticsService.addTile(dashboard.id, saved1.id, "table");
			const tile2 = await analyticsService.addTile(dashboard.id, saved2.id, "stat-card");

			// Initial order: tile1, tile2
			let tiles = analyticsService.getDashboard(dashboard.id)!.tiles;
			expect(tiles[0].id).toBe(tile1!.id);
			expect(tiles[1].id).toBe(tile2!.id);

			// Move tile1 down
			const moved = await analyticsService.reorderTile(dashboard.id, tile1!.id, "down");
			expect(moved).toBe(true);

			// New order: tile2, tile1
			tiles = analyticsService.getDashboard(dashboard.id)!.tiles;
			expect(tiles[0].id).toBe(tile2!.id);
			expect(tiles[1].id).toBe(tile1!.id);
		});

		it("should not reorder beyond boundaries", async () => {
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			const dashboard = await analyticsService.createDashboard("D");
			await analyticsService.addTile(dashboard.id, saved.id, "table");

			// Single tile — cannot move up
			const moved = await analyticsService.reorderTile(dashboard.id, analyticsService.getDashboard(dashboard.id)!.tiles[0].id, "up");
			expect(moved).toBe(false);
		});

		it("should emit analytics.dashboard.tile.reordered event", async () => {
			const events = collectEvents(eventBus, "*");
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			const dashboard = await analyticsService.createDashboard("D");
			await analyticsService.addTile(dashboard.id, saved.id, "table");
			await analyticsService.addTile(dashboard.id, saved.id, "stat-card");

			const tileId = analyticsService.getDashboard(dashboard.id)!.tiles[0].id;
			await analyticsService.reorderTile(dashboard.id, tileId, "down");

			expect(events).toContain("analytics.dashboard.tile.reordered");
		});
	});

	// ── Dashboard rename + description ──────────────────────

	describe("dashboard rename and description", () => {
		it("should rename a dashboard", async () => {
			const dashboard = await analyticsService.createDashboard("Old Name");
			await analyticsService.updateDashboard(dashboard.id, { name: "New Name" });

			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.name).toBe("New Name");
		});

		it("should update dashboard description", async () => {
			const dashboard = await analyticsService.createDashboard("D");
			await analyticsService.updateDashboard(dashboard.id, { description: "Monthly KPIs" });

			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.description).toBe("Monthly KPIs");
		});

		it("should emit analytics.dashboard.updated event", async () => {
			const events = collectEvents(eventBus, "*");
			const dashboard = await analyticsService.createDashboard("D");

			await analyticsService.updateDashboard(dashboard.id, { name: "D2", description: "Desc" });

			expect(events).toContain("analytics.dashboard.updated");
		});
	});

	// ── Saved query persistence with filters/sort/limit ─────

	describe("saved query with filters/sort/limit", () => {
		it("should persist and run a saved query with filters", async () => {
			const saved = await analyticsService.saveQuery(
				"Filtered Query",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
					filters: [{ column: "Category", operator: "=", value: "Electronics" }],
				},
			);

			expect(saved.filters).toHaveLength(1);

			const result = await analyticsService.runSavedQuery(saved.id);
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]["Category"]).toBe("Electronics");
		});

		it("should persist and run a saved query with sort and limit", async () => {
			const saved = await analyticsService.saveQuery(
				"Top Products",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Product" }],
					measures: [{ column: "Amount", function: "SUM" }],
					sort: [{ column: "SUM(Amount)", direction: "desc" }],
					limit: 2,
				},
			);

			expect(saved.sort).toBeDefined();
			expect(saved.limit).toBe(2);

			const result = await analyticsService.runSavedQuery(saved.id);
			expect(result.rows).toHaveLength(2);
			expect(result.rows[0]["Product"]).toBe("Laptop");
		});
	});

	// ── Edge cases ──────────────────────────────────────────

	describe("edge cases", () => {
		it("should handle empty filter value gracefully", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "COUNT" }],
				filters: [{ column: "Category", operator: "=", value: "" }],
			});

			// No rows match empty string
			expect(result.rows).toHaveLength(0);
		});

		it("should handle sort on string column", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SALES_HEADERS, rows: SALES_ROWS } }],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "COUNT" }],
				sort: [{ column: "Category", direction: "asc" }],
			});

			const categories = result.rows.map((r) => r["Category"] as string);
			expect(categories[0]).toBe("Books");
			expect(categories[categories.length - 1]).toBe("Electronics");
		});

		it("should handle rename of nonexistent query", async () => {
			const result = await analyticsService.renameQuery("nonexistent", "New Name");
			expect(result).toBeUndefined();
		});

		it("should handle duplicate of nonexistent query", async () => {
			const result = await analyticsService.duplicateQuery("nonexistent");
			expect(result).toBeUndefined();
		});

		it("should handle reorder of nonexistent tile", async () => {
			const dashboard = await analyticsService.createDashboard("D");
			const result = await analyticsService.reorderTile(dashboard.id, "nonexistent", "up");
			expect(result).toBe(false);
		});
	});
});
