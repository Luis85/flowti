/**
 * Flow 25: Analytics Pipeline
 *
 * Tests the end-to-end analytics pipeline:
 * Configure sources → build query → execute → verify results →
 * save query → load saved query → delete query.
 *
 * Event sequence:
 *   analytics.query.started → analytics.query.completed →
 *   analytics.query.saved → analytics.query.deleted
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import { AnalyticsEngine } from "../../src/domain/analytics/AnalyticsEngine";
import type {
	AnalyticsQuery,
	AnalyticsResult,
	AnalyticsSource,
	SavedAnalyticsQuery,
	ParsedSourceData,
} from "../../src/domain/analytics/types";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { createMockStorage, collectEvents, waitForAsync } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

function makeCsvData(headers: string[], rows: string[][]): ParsedSourceData {
	return { headers, rows };
}

const SALES_HEADERS = ["Date", "Category", "Amount", "Quantity"];
const SALES_ROWS: string[][] = [
	["2025-01-15", "Electronics", "500", "2"],
	["2025-01-20", "Books", "150", "5"],
	["2025-02-10", "Electronics", "300", "1"],
	["2025-02-15", "Clothing", "200", "3"],
	["2025-03-01", "Books", "100", "4"],
	["2025-03-10", "Electronics", "400", "2"],
];

const REGIONS_HEADERS = ["Category", "Region"];
const REGIONS_ROWS: string[][] = [
	["Electronics", "North"],
	["Books", "South"],
	["Clothing", "West"],
];

function makeSalesSource(alias = "sales"): AnalyticsSource {
	return {
		alias,
		data: makeCsvData(SALES_HEADERS, SALES_ROWS),
	};
}

function makeRegionsSource(alias = "regions"): AnalyticsSource {
	return {
		alias,
		data: makeCsvData(REGIONS_HEADERS, REGIONS_ROWS),
	};
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 25: Analytics Pipeline", () => {
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

	// ── Single-source query ─────────────────────────────────

	describe("single-source query", () => {
		it("should execute SUM aggregation grouped by category", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [
					{ column: "Amount", type: "number" },
				],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			const result = await analyticsService.runQuery(query, "test");

			expect(result.rows.length).toBe(3);
			expect(result.groupCount).toBe(3);
			expect(result.sourceRowCount).toBe(6);
			expect(result.columns).toContain("Category");
			expect(result.columns).toContain("SUM(Amount)");

			// Verify category sums
			const byCategory = Object.fromEntries(
				result.rows.map((r) => [r["Category"], r["SUM(Amount)"]]),
			);
			expect(byCategory["Electronics"]).toBe(1200);
			expect(byCategory["Books"]).toBe(250);
			expect(byCategory["Clothing"]).toBe(200);
		});

		it("should execute COUNT aggregation", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Category", function: "COUNT" }],
			};

			const result = await analyticsService.runQuery(query);

			const byCategory = Object.fromEntries(
				result.rows.map((r) => [r["Category"], r["COUNT(Category)"]]),
			);
			expect(byCategory["Electronics"]).toBe(3);
			expect(byCategory["Books"]).toBe(2);
			expect(byCategory["Clothing"]).toBe(1);
		});

		it("should execute AVG aggregation", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "AVG" }],
			};

			const result = await analyticsService.runQuery(query);

			const byCategory = Object.fromEntries(
				result.rows.map((r) => [r["Category"], r["AVG(Amount)"]]),
			);
			expect(byCategory["Electronics"]).toBe(400); // (500+300+400)/3
			expect(byCategory["Books"]).toBe(125); // (150+100)/2
		});

		it("should execute multiple measures simultaneously", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [
					{ column: "Amount", type: "number" },
					{ column: "Quantity", type: "number" },
				],
				dimensions: [{ column: "Category" }],
				measures: [
					{ column: "Amount", function: "SUM" },
					{ column: "Quantity", function: "SUM" },
					{ column: "Amount", function: "MIN" },
					{ column: "Amount", function: "MAX" },
				],
			};

			const result = await analyticsService.runQuery(query);

			expect(result.columns).toContain("SUM(Amount)");
			expect(result.columns).toContain("SUM(Quantity)");
			expect(result.columns).toContain("MIN(Amount)");
			expect(result.columns).toContain("MAX(Amount)");

			const electronics = result.rows.find((r) => r["Category"] === "Electronics")!;
			expect(electronics["SUM(Amount)"]).toBe(1200);
			expect(electronics["SUM(Quantity)"]).toBe(5);
			expect(electronics["MIN(Amount)"]).toBe(300);
			expect(electronics["MAX(Amount)"]).toBe(500);
		});
	});

	// ── Multi-source join ───────────────────────────────────

	describe("multi-source join", () => {
		it("should inner join two sources on a key column", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource(), makeRegionsSource()],
				joins: [{
					leftSource: "sales",
					leftColumn: "Category",
					rightSource: "regions",
					rightColumn: "Category",
					type: "inner",
				}],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			const result = await analyticsService.runQuery(query);

			expect(result.rows.length).toBe(3);
			const byRegion = Object.fromEntries(
				result.rows.map((r) => [r["Region"], r["SUM(Amount)"]]),
			);
			expect(byRegion["North"]).toBe(1200);  // Electronics
			expect(byRegion["South"]).toBe(250);    // Books
			expect(byRegion["West"]).toBe(200);     // Clothing
		});

		it("should left join preserving all left rows", async () => {
			// Add a category to sales that doesn't exist in regions
			const salesData = makeCsvData(SALES_HEADERS, [
				...SALES_ROWS,
				["2025-04-01", "Toys", "50", "10"],
			]);

			const query: AnalyticsQuery = {
				sources: [
					{ alias: "sales", data: salesData },
					makeRegionsSource(),
				],
				joins: [{
					leftSource: "sales",
					leftColumn: "Category",
					rightSource: "regions",
					rightColumn: "Category",
					type: "left",
				}],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			const result = await analyticsService.runQuery(query);

			// Left join keeps the unmatched "Toys" row — its Region is "Unknown"
			const regions = result.rows.map((r) => r["Region"]);
			expect(regions).toContain("Unknown");
			expect(result.rows.length).toBe(4); // North, South, West, Unknown
		});
	});

	// ── Time bucketing ──────────────────────────────────────

	describe("time bucketing", () => {
		it("should bucket by month", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [
					{ column: "Amount", type: "number" },
					{ column: "Date", type: "date" },
				],
				dimensions: [],
				measures: [{ column: "Amount", function: "SUM" }],
				timeBucket: { column: "Date", period: "month" },
			};

			const result = await analyticsService.runQuery(query);

			// 3 months: Jan, Feb, Mar
			expect(result.rows.length).toBe(3);
			const byMonth = Object.fromEntries(
				result.rows.map((r) => [r["Date_month"], r["SUM(Amount)"]]),
			);
			expect(byMonth["2025-01"]).toBe(650);   // 500 + 150
			expect(byMonth["2025-02"]).toBe(500);   // 300 + 200
			expect(byMonth["2025-03"]).toBe(500);   // 100 + 400
		});

		it("should bucket by quarter", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [
					{ column: "Amount", type: "number" },
					{ column: "Date", type: "date" },
				],
				dimensions: [],
				measures: [{ column: "Amount", function: "SUM" }],
				timeBucket: { column: "Date", period: "quarter" },
			};

			const result = await analyticsService.runQuery(query);

			// All dates are Q1 2025
			expect(result.rows.length).toBe(1);
			expect(result.rows[0]["SUM(Amount)"]).toBe(1650);
		});

		it("should combine time bucket with dimension", async () => {
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [
					{ column: "Amount", type: "number" },
					{ column: "Date", type: "date" },
				],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
				timeBucket: { column: "Date", period: "month" },
			};

			const result = await analyticsService.runQuery(query);

			// 3 categories × up to 3 months = up to 9, but not every combo exists
			expect(result.rows.length).toBeGreaterThanOrEqual(5);
			expect(result.columns).toContain("Category");
			expect(result.columns).toContain("Date_month");
			expect(result.columns).toContain("SUM(Amount)");
		});
	});

	// ── Event lifecycle ─────────────────────────────────────

	describe("event lifecycle", () => {
		it("should emit started and completed events for successful query", async () => {
			const events = collectEvents(eventBus, "*");
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			await analyticsService.runQuery(query, "Test Query");

			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.started");
			expect(analyticsEvents).toContain("analytics.query.completed");
		});

		it("should emit events in correct order", async () => {
			const events = collectEvents(eventBus, "*");
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			await analyticsService.runQuery(query);

			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			const startIdx = analyticsEvents.indexOf("analytics.query.started");
			const completeIdx = analyticsEvents.indexOf("analytics.query.completed");
			expect(startIdx).toBeGreaterThanOrEqual(0);
			expect(completeIdx).toBeGreaterThan(startIdx);
		});

		it("should return empty result for query with no sources", async () => {
			const events = collectEvents(eventBus, "*");
			const query: AnalyticsQuery = {
				sources: [],
				joins: [],
				columnTypeHints: [],
				dimensions: [],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			const result = await analyticsService.runQuery(query);

			// No sources → empty result
			expect(result.rows.length).toBe(0);
			expect(result.sourceRowCount).toBe(0);

			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.started");
			expect(analyticsEvents).toContain("analytics.query.completed");
		});
	});

	// ── Saved query CRUD ────────────────────────────────────

	describe("saved query CRUD", () => {
		it("should save and retrieve a query", async () => {
			const saved = await analyticsService.saveQuery(
				"My Query",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			expect(saved.id).toBeTruthy();
			expect(saved.name).toBe("My Query");
			expect(saved.createdAt).toBeTruthy();

			const queries = analyticsService.listQueries();
			expect(queries).toHaveLength(1);
			expect(queries[0].id).toBe(saved.id);
		});

		it("should emit analytics.query.saved event", async () => {
			const events = collectEvents(eventBus, "*");

			await analyticsService.saveQuery(
				"My Query",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.saved");
		});

		it("should get a saved query by ID", async () => {
			const saved = await analyticsService.saveQuery(
				"Query A",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "Amount", function: "COUNT" }],
				},
			);

			const retrieved = analyticsService.getQuery(saved.id);
			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe("Query A");
			expect(retrieved?.measures).toHaveLength(1);
		});

		it("should return undefined for nonexistent query ID", () => {
			expect(analyticsService.getQuery("nonexistent")).toBeUndefined();
		});

		it("should delete a saved query", async () => {
			const saved = await analyticsService.saveQuery(
				"To Delete",
				[{ alias: "s", csvPath: "data.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "X", function: "SUM" }],
				},
			);

			const deleted = await analyticsService.deleteQuery(saved.id);
			expect(deleted).toBe(true);
			expect(analyticsService.listQueries()).toHaveLength(0);
		});

		it("should emit analytics.query.deleted event", async () => {
			const events = collectEvents(eventBus, "*");
			const saved = await analyticsService.saveQuery(
				"Temp",
				[{ alias: "s", csvPath: "data.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "X", function: "SUM" }],
				},
			);

			await analyticsService.deleteQuery(saved.id);

			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.deleted");
		});

		it("should return false when deleting nonexistent query", async () => {
			const result = await analyticsService.deleteQuery("nonexistent");
			expect(result).toBe(false);
		});

		it("should manage multiple saved queries", async () => {
			await analyticsService.saveQuery(
				"Q1", [{ alias: "s", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "X", function: "SUM" }] },
			);
			await analyticsService.saveQuery(
				"Q2", [{ alias: "s", csvPath: "b.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Y", function: "COUNT" }] },
			);

			expect(analyticsService.listQueries()).toHaveLength(2);

			// Delete first
			const first = analyticsService.listQueries()[0];
			await analyticsService.deleteQuery(first.id);
			expect(analyticsService.listQueries()).toHaveLength(1);
			expect(analyticsService.listQueries()[0].name).toBe("Q2");
		});
	});

	// ── Saved query execution ───────────────────────────────

	describe("saved query execution", () => {
		it("should execute a saved query by ID", async () => {
			analyticsService.setReadCsv(async (csvPath: string) => {
				if (csvPath === "data/sales.csv") {
					return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
				}
				return null;
			});

			const saved = await analyticsService.saveQuery(
				"Sales Summary",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			const result = await analyticsService.runSavedQuery(saved.id);

			expect(result.rows.length).toBe(3);
			expect(result.groupCount).toBe(3);

			// Check lastRun was updated
			const updated = analyticsService.getQuery(saved.id);
			expect(updated?.lastRun).toBeTruthy();
			expect(updated?.lastRowCount).toBe(3);
		});

		it("should throw for nonexistent saved query", async () => {
			await expect(analyticsService.runSavedQuery("nonexistent")).rejects.toThrow("not found");
		});

		it("should throw when CSV reader is not configured", async () => {
			const saved = await analyticsService.saveQuery(
				"No Reader",
				[{ alias: "s", csvPath: "data.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "X", function: "SUM" }],
				},
			);

			await expect(analyticsService.runSavedQuery(saved.id)).rejects.toThrow("reader not configured");
		});

		it("should throw when CSV file is not found", async () => {
			analyticsService.setReadCsv(async () => null);

			const saved = await analyticsService.saveQuery(
				"Missing CSV",
				[{ alias: "s", csvPath: "missing.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "X", function: "SUM" }],
				},
			);

			await expect(analyticsService.runSavedQuery(saved.id)).rejects.toThrow("CSV not found");
		});
	});

	// ── Persistence across load cycles ──────────────────────

	describe("persistence", () => {
		it("should persist saved queries across service instances", async () => {
			const mock = createMockStorage<AnalyticsState>();
			const service1 = new AnalyticsService({ storage: mock.storage, eventBus });
			await service1.load();

			await service1.saveQuery(
				"Persistent Query",
				[{ alias: "s", csvPath: "data.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			// New instance, same storage
			const service2 = new AnalyticsService({ storage: mock.storage, eventBus });
			await service2.load();

			const queries = service2.listQueries();
			expect(queries).toHaveLength(1);
			expect(queries[0].name).toBe("Persistent Query");
			expect(queries[0].dimensions).toHaveLength(1);
			expect(queries[0].measures).toHaveLength(1);
		});
	});

	// ── Engine column type detection ────────────────────────

	describe("column type detection", () => {
		it("should auto-detect number and date columns", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				SALES_HEADERS,
				SALES_ROWS,
			);

			const hintMap = Object.fromEntries(hints.map((h) => [h.column, h.type]));
			expect(hintMap["Amount"]).toBe("number");
			expect(hintMap["Quantity"]).toBe("number");
			expect(hintMap["Date"]).toBe("date");
			expect(hintMap["Category"]).toBe("string");
		});
	});

	// ── End-to-end pipeline ─────────────────────────────────

	describe("end-to-end pipeline", () => {
		it("should complete full cycle: query → save → reload → execute → delete", async () => {
			const events = collectEvents(eventBus, "*");

			analyticsService.setReadCsv(async (csvPath: string) => {
				if (csvPath === "data/sales.csv") {
					return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
				}
				return null;
			});

			// 1. Direct query
			const query: AnalyticsQuery = {
				sources: [makeSalesSource()],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};

			const directResult = await analyticsService.runQuery(query, "Direct");
			expect(directResult.rows.length).toBe(3);

			// 2. Save the query
			const saved = await analyticsService.saveQuery(
				"Sales by Category",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: query.joins,
					columnTypeHints: query.columnTypeHints,
					dimensions: query.dimensions,
					measures: query.measures,
				},
			);
			expect(saved.id).toBeTruthy();

			// 3. Execute saved query
			const savedResult = await analyticsService.runSavedQuery(saved.id);
			expect(savedResult.rows.length).toBe(3);

			// Results should match
			expect(savedResult.groupCount).toBe(directResult.groupCount);

			// 4. Delete the query
			const deleted = await analyticsService.deleteQuery(saved.id);
			expect(deleted).toBe(true);
			expect(analyticsService.listQueries()).toHaveLength(0);

			// 5. Verify event sequence
			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.started");
			expect(analyticsEvents).toContain("analytics.query.completed");
			expect(analyticsEvents).toContain("analytics.query.saved");
			expect(analyticsEvents).toContain("analytics.query.deleted");
		});
	});
});
