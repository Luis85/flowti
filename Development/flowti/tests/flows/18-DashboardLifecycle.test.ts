/**
 * Flow 18: Dashboard Lifecycle
 *
 * Tests the end-to-end dashboard management flow:
 * Create dashboard → add tiles → run tile queries →
 * apply filters → update tiles → delete dashboard.
 *
 * Event sequence:
 *   analytics.loaded → analytics.dashboard.created → analytics.tile.added →
 *   analytics.query.started → analytics.query.completed →
 *   analytics.tile.updated → analytics.dashboard.deleted
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { createMockStorage, collectEvents } from "./testHelpers";

const SAMPLE_CSV = {
	headers: ["Region", "Product", "Revenue"],
	rows: [
		["US", "Widget A", "100"],
		["EU", "Widget A", "200"],
		["US", "Widget B", "150"],
		["EU", "Widget B", "250"],
	],
	rowCount: 4,
	detectedDelimiter: ",",
};

describe("Flow 18: Dashboard Lifecycle", () => {
	let eventBus: IEventBus;
	let service: AnalyticsService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const { storage } = createMockStorage<AnalyticsState>();

		service = new AnalyticsService({
			storage,
			eventBus,
			readCsv: vi.fn(async () => SAMPLE_CSV),
		});

		await service.load();
	});

	it("creates a dashboard with name and description", async () => {
		const events = collectEvents(eventBus, "*");
		const dashboard = await service.createDashboard("Sales Overview", "Monthly sales dashboard");

		expect(dashboard.id).toBeTruthy();
		expect(dashboard.name).toBe("Sales Overview");
		expect(dashboard.description).toBe("Monthly sales dashboard");
		expect(dashboard.tiles).toEqual([]);
		expect(events).toContain("analytics.dashboard.created");
	});

	it("adds tiles to a dashboard and runs query through tile", async () => {
		const saved = await service.saveQuery(
			"Regional Revenue",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM", label: "Total Revenue" }],
			},
		);

		const dashboard = await service.createDashboard("My Dashboard");
		const tile = await service.addTile(dashboard.id, saved.id, "table", "Revenue Table");

		expect(tile).toBeTruthy();
		expect(tile!.queryId).toBe(saved.id);
		expect(tile!.displayMode).toBe("table");
		expect(tile!.title).toBe("Revenue Table");

		// Run the tile's query
		const result = await service.runSavedQuery(saved.id);
		expect(result.rows.length).toBe(2);
		expect(result.columns).toContain("Total Revenue");
	});

	it("updates tile display mode and properties", async () => {
		const saved = await service.saveQuery(
			"Product Revenue",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Product" }],
				measures: [{ column: "Revenue", function: "SUM", label: "Total" }],
			},
		);

		const dashboard = await service.createDashboard("Test Dashboard");
		const tile = await service.addTile(dashboard.id, saved.id, "table");

		const updated = await service.updateTile(dashboard.id, tile!.id, {
			displayMode: "bar-chart",
			width: 3,
			height: 2,
			chartValueColumn: "Total",
		});

		expect(updated).toBeTruthy();
		expect(updated!.displayMode).toBe("bar-chart");
		expect(updated!.width).toBe(3);
		expect(updated!.height).toBe(2);
		expect(updated!.chartValueColumn).toBe("Total");
	});

	it("applies dashboard-level post-filters to query results", async () => {
		const saved = await service.saveQuery(
			"All Regions",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "Revenue", type: "number" }],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM", label: "Total" }],
			},
		);

		// Run with dashboard filter
		const filtered = await service.runSavedQueryWithFilters(
			saved.id,
			[{ column: "Region", values: ["EU"] }],
		);

		expect(filtered.rows.length).toBe(1);
		expect(filtered.rows[0]["Region"]).toBe("EU");
		expect(filtered.rows[0]["Total"]).toBe(450); // 200+250
	});

	it("removes a tile from a dashboard", async () => {
		const saved = await service.saveQuery(
			"Temp Query",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			},
		);

		const dashboard = await service.createDashboard("Tile Test");
		const tile = await service.addTile(dashboard.id, saved.id, "stat-card");

		const removed = await service.removeTile(dashboard.id, tile!.id);
		expect(removed).toBe(true);

		const updated = service.getDashboard(dashboard.id);
		expect(updated!.tiles.length).toBe(0);
	});

	it("deletes a dashboard and all its tiles", async () => {
		const events = collectEvents(eventBus, "*");
		const dashboard = await service.createDashboard("Ephemeral");

		const deleted = await service.deleteDashboard(dashboard.id);
		expect(deleted).toBe(true);
		expect(service.getDashboard(dashboard.id)).toBeUndefined();
		expect(events).toContain("analytics.dashboard.deleted");
	});

	it("sets and retrieves default dashboard", async () => {
		const d1 = await service.createDashboard("Dashboard 1");
		const d2 = await service.createDashboard("Dashboard 2");

		await service.setDefaultDashboard(d1.id);
		expect(service.getDefaultDashboard()?.id).toBe(d1.id);

		await service.setDefaultDashboard(d2.id);
		expect(service.getDefaultDashboard()?.id).toBe(d2.id);

		await service.setDefaultDashboard(null);
		expect(service.getDefaultDashboard()).toBeUndefined();
	});

	it("toggles dashboard favorite status", async () => {
		const dashboard = await service.createDashboard("Fav Test");

		const fav1 = await service.toggleDashboardFavorite(dashboard.id);
		expect(fav1).toBe(true);

		const fav2 = await service.toggleDashboardFavorite(dashboard.id);
		expect(fav2).toBe(false);
	});

	it("emits dashboard lifecycle events in correct order", async () => {
		const events = collectEvents(eventBus, "*");

		const saved = await service.saveQuery(
			"Events Test Query",
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Region" }],
				measures: [{ column: "Revenue", function: "SUM" }],
			},
		);

		const dashboard = await service.createDashboard("Events Dashboard");
		await service.addTile(dashboard.id, saved.id, "table");
		await service.deleteDashboard(dashboard.id);

		expect(events).toContain("analytics.query.saved");
		expect(events).toContain("analytics.dashboard.created");
		expect(events).toContain("analytics.dashboard.tile.added");
		expect(events).toContain("analytics.dashboard.deleted");

		const createIdx = events.indexOf("analytics.dashboard.created");
		const addIdx = events.indexOf("analytics.dashboard.tile.added");
		const deleteIdx = events.indexOf("analytics.dashboard.deleted");
		expect(createIdx).toBeLessThan(addIdx);
		expect(addIdx).toBeLessThan(deleteIdx);
	});

	it("saves and restores filter presets", async () => {
		const dashboard = await service.createDashboard("Preset Test");

		const preset = await service.saveFilterPreset(
			dashboard.id,
			"US Only",
			[{ column: "Region", values: ["US"] }],
		);

		expect(preset).toBeTruthy();
		expect(preset!.name).toBe("US Only");

		const d = service.getDashboard(dashboard.id);
		expect(d!.savedFilterPresets).toHaveLength(1);
		expect(d!.savedFilterPresets![0].filters[0].column).toBe("Region");

		const deleted = await service.deleteFilterPreset(dashboard.id, preset!.id);
		expect(deleted).toBe(true);

		const d2 = service.getDashboard(dashboard.id);
		expect(d2!.savedFilterPresets).toHaveLength(0);
	});
});
