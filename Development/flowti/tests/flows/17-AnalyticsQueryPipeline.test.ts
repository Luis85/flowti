/**
 * Flow 17: Analytics Query Pipeline
 *
 * Tests the end-to-end query builder flow:
 * Load CSV source → configure dimensions/measures → execute query →
 * save query → reload saved query → re-execute.
 *
 * Event sequence:
 *   analytics.loaded → analytics.query.started → analytics.query.completed →
 *   analytics.query.saved → analytics.query.started → analytics.query.completed
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState, SavedAnalyticsQuery } from "../../src/domain/analytics/types";
import { createMockStorage, collectEvents, waitForAsync } from "./testHelpers";

const SAMPLE_CSV = {
	headers: ["Region", "Product", "Revenue", "Quarter"],
	rows: [
		["US", "Widget A", "100", "Q1"],
		["EU", "Widget A", "200", "Q1"],
		["US", "Widget B", "150", "Q2"],
		["EU", "Widget B", "250", "Q2"],
		["US", "Widget A", "120", "Q3"],
		["EU", "Widget A", "220", "Q3"],
		["US", "Widget B", "180", "Q4"],
		["EU", "Widget B", "280", "Q4"],
	],
	rowCount: 8,
	detectedDelimiter: ",",
};

describe("Flow 17: Analytics Query Pipeline", () => {
	let eventBus: IEventBus;
	let service: AnalyticsService;
	let events: string[];

	beforeEach(async () => {
		eventBus = new EventBus();
		const { storage } = createMockStorage<AnalyticsState>();

		service = new AnalyticsService({
			storage,
			eventBus,
			readCsv: vi.fn(async () => SAMPLE_CSV),
		});

		events = collectEvents(eventBus, "*");
		await service.load();
	});

	it("executes a query with dimensions and measures and returns grouped results", async () => {
		const result = await service.runQuery({
			sources: [{
				alias: "sales",
				data: { headers: SAMPLE_CSV.headers, rows: SAMPLE_CSV.rows },
			}],
			joins: [],
			columnTypeHints: [
				{ column: "Revenue", type: "number" },
				{ column: "Quarter", type: "string" },
			],
			dimensions: [{ column: "Region" }],
			measures: [{ column: "Revenue", function: "SUM", label: "Total Revenue" }],
		});

		expect(result.columns).toContain("Region");
		expect(result.columns).toContain("Total Revenue");
		expect(result.rows.length).toBe(2); // US, EU
		expect(result.groupCount).toBe(2);

		const usRow = result.rows.find((r) => r["Region"] === "US");
		expect(usRow).toBeTruthy();
		expect(usRow!["Total Revenue"]).toBe(550); // 100+150+120+180
	});

	it("saves and reloads a query preserving all configuration", async () => {
		const queryConfig = {
			joins: [],
			columnTypeHints: [{ column: "Revenue", type: "number" as const }],
			dimensions: [{ column: "Region" }],
			measures: [{ column: "Revenue", function: "SUM" as const, label: "Total Revenue" }],
			filters: [{ column: "Region", operator: "=" as const, value: "US" }],
			sort: [{ column: "Total Revenue", direction: "desc" as const }],
			limit: 10,
		};

		const saved = await service.saveQuery(
			"Sales by Region",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			queryConfig,
		);

		expect(saved.id).toBeTruthy();
		expect(saved.name).toBe("Sales by Region");
		expect(saved.dimensions).toEqual(queryConfig.dimensions);
		expect(saved.measures).toEqual(queryConfig.measures);
		expect(saved.filters).toEqual(queryConfig.filters);
		expect(saved.sort).toEqual(queryConfig.sort);
		expect(saved.limit).toBe(10);

		// Verify retrieval
		const retrieved = service.getQuery(saved.id);
		expect(retrieved).toBeTruthy();
		expect(retrieved!.name).toBe("Sales by Region");
	});

	it("runs a saved query by ID loading sources from vault", async () => {
		const saved = await service.saveQuery(
			"Revenue Query",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM", label: "Total Revenue" }],
			},
		);

		const result = await service.runSavedQuery(saved.id);

		expect(result.rows.length).toBe(2);
		expect(result.columns).toContain("Total Revenue");
	});

	it("applies dashboard-level post-filters to saved query results", async () => {
		const saved = await service.saveQuery(
			"All Sales",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM", label: "Total Revenue" }],
			},
		);

		const result = await service.runSavedQueryWithFilters(
			saved.id,
			[{ column: "Region", values: ["US"] }],
		);

		expect(result.rows.length).toBe(1);
		expect(result.rows[0]["Region"]).toBe("US");
	});

	it("emits query lifecycle events in correct order", async () => {
		await service.runQuery({
			sources: [{
				alias: "sales",
				data: { headers: SAMPLE_CSV.headers, rows: SAMPLE_CSV.rows },
			}],
			joins: [],
			columnTypeHints: [],
			dimensions: [{ column: "Region" }],
			measures: [{ column: "Revenue", function: "SUM" }],
		});

		await waitForAsync();

		expect(events).toContain("analytics.loaded");
		expect(events).toContain("analytics.query.started");
		expect(events).toContain("analytics.query.completed");
		const startIdx = events.indexOf("analytics.query.started");
		const completeIdx = events.indexOf("analytics.query.completed");
		expect(startIdx).toBeLessThan(completeIdx);
	});

	it("updates and deletes saved queries", async () => {
		const saved = await service.saveQuery(
			"Original",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			},
		);

		// Update
		await service.updateQuery(
			saved.id,
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Revenue", function: "AVG" }],
			},
		);

		const updated = service.getQuery(saved.id);
		expect(updated!.dimensions[0].column).toBe("Product");
		expect(updated!.measures[0].function).toBe("AVG");

		// Delete
		const deleted = await service.deleteQuery(saved.id);
		expect(deleted).toBe(true);
		expect(service.getQuery(saved.id)).toBeUndefined();
	});

	it("caches saved query results and returns cached on second call", async () => {
		const saved = await service.saveQuery(
			"Cached Query",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			},
		);

		const result1 = await service.runSavedQuery(saved.id);
		const result2 = await service.runSavedQuery(saved.id);

		// Both return same result (cached)
		expect(result1.rows).toEqual(result2.rows);
		expect(result1.columns).toEqual(result2.columns);
	});

	it("invalidates cache when query is updated", async () => {
		const saved = await service.saveQuery(
			"Cache Test",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			},
		);

		await service.runSavedQuery(saved.id);

		// Update query — should invalidate cache
		await service.updateQuery(saved.id, saved.sources, {
			joins: [],
			columnTypeHints: [{ column: "Revenue", type: "number" }],
			dimensions: [{ column: "Product" }],
			measures: [{ column: "Revenue", function: "SUM" }],
		});

		const result = await service.runSavedQuery(saved.id);
		// Should have Product dimension now
		expect(result.columns).toContain("Product");
	});
});
