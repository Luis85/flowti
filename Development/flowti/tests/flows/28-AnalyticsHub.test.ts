/**
 * Flow 28: Analytics Hub
 *
 * End-to-end integration test covering:
 * - Hub lifecycle (analytics.loaded)
 * - Query → save → dashboard → tile → results pipeline
 * - Dashboard CRUD + tile CRUD events
 * - Base source resolution
 * - Mixed CSV + .base saved query execution
 * - Provider stats
 *
 * Event sequence:
 *   analytics.loaded → analytics.query.started → analytics.query.completed →
 *   analytics.query.saved → analytics.dashboard.created →
 *   analytics.dashboard.tile.added → analytics.dashboard.refreshed →
 *   analytics.dashboard.deleted
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import { BaseAnalyticsAdapter } from "../../src/domain/analytics/BaseAnalyticsAdapter";
import { AnalyticsHubProvider } from "../../src/domain/hub/AnalyticsHubProvider";
import type {
	AnalyticsQuery,
	AnalyticsState,
	ParsedSourceData,
} from "../../src/domain/analytics/types";
import type { ResolvedColumn, VaultFileInfo } from "../../src/domain/dataExchange/types";
import { createMockStorage, collectEvents } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["Category", "Amount"];
const SALES_ROWS: string[][] = [
	["Electronics", "500"],
	["Books", "150"],
	["Electronics", "300"],
];

function makeSalesSource(): { headers: string[]; rows: string[][] } {
	return { headers: SALES_HEADERS, rows: SALES_ROWS };
}

function makeBaseColumns(): ResolvedColumn[] {
	return [
		{ key: "file.name", header: "name", source: "file", resolveKey: "file.name" },
		{ key: "note.stage", header: "stage", source: "frontmatter", resolveKey: "stage" },
		{ key: "note.priority", header: "priority", source: "frontmatter", resolveKey: "priority" },
	];
}

function makeBaseFiles(): VaultFileInfo[] {
	return [
		{ path: "items/a.md", basename: "a", extension: "md", folder: "items", frontmatter: { stage: "active", priority: "1" } },
		{ path: "items/b.md", basename: "b", extension: "md", folder: "items", frontmatter: { stage: "planned", priority: "2" } },
		{ path: "items/c.md", basename: "c", extension: "md", folder: "items", frontmatter: { stage: "active", priority: "1" } },
	];
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 28: Analytics Hub", () => {
	let eventBus: IEventBus;
	let analyticsService: AnalyticsService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		analyticsService = new AnalyticsService({
			storage: mock.storage,
			eventBus,
		});
	});

	// ── Hub lifecycle ────────────────────────────────────────

	describe("hub lifecycle", () => {
		it("should emit analytics.loaded on service load", async () => {
			const events = collectEvents(eventBus, "*");
			await analyticsService.load();

			expect(events).toContain("analytics.loaded");
		});

		it("should report correct counts in loaded event", async () => {
			let payload: { queryCount: number; dashboardCount: number } | null = null;
			eventBus.on("analytics.loaded", (e: unknown) => {
				const event = e as { payload: { queryCount: number; dashboardCount: number } };
				payload = event.payload;
			});

			await analyticsService.load();

			expect(payload).not.toBeNull();
			expect(payload!.queryCount).toBe(0);
			expect(payload!.dashboardCount).toBe(0);
		});
	});

	// ── Full pipeline: query → save → dashboard → tile ──────

	describe("full pipeline", () => {
		beforeEach(async () => {
			await analyticsService.load();
			analyticsService.setReadCsv(async (csvPath: string) => {
				if (csvPath === "data/sales.csv") {
					return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
				}
				return null;
			});
		});

		it("should complete query → save → dashboard → tile → results cycle", async () => {
			const events = collectEvents(eventBus, "*");

			// 1. Execute ad-hoc query
			const query: AnalyticsQuery = {
				sources: [{ alias: "sales", data: makeSalesSource() }],
				joins: [],
				columnTypeHints: [{ column: "Amount", type: "number" }],
				dimensions: [{ column: "Category" }],
				measures: [{ column: "Amount", function: "SUM" }],
			};
			const result = await analyticsService.runQuery(query, "Sales");
			expect(result.rows.length).toBe(2); // Electronics, Books

			// 2. Save the query
			const saved = await analyticsService.saveQuery(
				"Sales Summary",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: query.columnTypeHints, dimensions: query.dimensions, measures: query.measures },
			);
			expect(saved.id).toBeTruthy();

			// 3. Create a dashboard
			const dashboard = await analyticsService.createDashboard("My Dashboard", "Test description");
			expect(dashboard.id).toBeTruthy();
			expect(dashboard.tiles).toHaveLength(0);

			// 4. Add tile to dashboard
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "table", "Sales Table");
			expect(tile).toBeDefined();
			expect(tile!.queryId).toBe(saved.id);
			expect(tile!.displayMode).toBe("table");

			// 5. Execute the saved query (simulating tile refresh)
			const tileResult = await analyticsService.runSavedQuery(saved.id);
			expect(tileResult.rows.length).toBe(2);

			// 6. Verify event sequence
			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.started");
			expect(analyticsEvents).toContain("analytics.query.completed");
			expect(analyticsEvents).toContain("analytics.query.saved");
			expect(analyticsEvents).toContain("analytics.dashboard.created");
			expect(analyticsEvents).toContain("analytics.dashboard.tile.added");
		});

		it("should support stat-card tile display mode", async () => {
			const saved = await analyticsService.saveQuery(
				"Stats Query",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			const dashboard = await analyticsService.createDashboard("Stats Board");
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "stat-card");

			expect(tile!.displayMode).toBe("stat-card");
		});

		it("should update tile properties", async () => {
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			const dashboard = await analyticsService.createDashboard("D");
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "table");

			const updated = await analyticsService.updateTile(dashboard.id, tile!.id, {
				displayMode: "stat-card",
				title: "Revenue",
			});

			expect(updated!.displayMode).toBe("stat-card");
			expect(updated!.title).toBe("Revenue");
		});

		it("should remove tile from dashboard", async () => {
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			const dashboard = await analyticsService.createDashboard("D");
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "table");

			const removed = await analyticsService.removeTile(dashboard.id, tile!.id);
			expect(removed).toBe(true);

			const d = analyticsService.getDashboard(dashboard.id);
			expect(d!.tiles).toHaveLength(0);
		});

		it("should delete dashboard and emit event", async () => {
			const events = collectEvents(eventBus, "*");
			const dashboard = await analyticsService.createDashboard("To Delete");

			await analyticsService.deleteDashboard(dashboard.id);

			expect(analyticsService.listDashboards()).toHaveLength(0);
			expect(events).toContain("analytics.dashboard.deleted");
		});
	});

	// ── .base source resolution ──────────────────────────────

	describe("base source resolution", () => {
		beforeEach(async () => {
			await analyticsService.load();

			const adapter = new BaseAnalyticsAdapter({
				scanColumns: vi.fn().mockResolvedValue(makeBaseColumns()),
				resolveFiles: vi.fn().mockResolvedValue(makeBaseFiles()),
			});
			analyticsService.setBaseAdapter(adapter);
		});

		it("should load .base file as ParsedSourceData", async () => {
			const data = await analyticsService.loadBase("items.base", 0);

			expect(data).not.toBeNull();
			expect(data!.headers).toEqual(["name", "stage", "priority"]);
			expect(data!.rows).toHaveLength(3);
			expect(data!.rows[0]).toEqual(["a", "active", "1"]);
		});

		it("should execute saved query with .base source", async () => {
			const saved = await analyticsService.saveQuery(
				"Base Query",
				[{ alias: "items", csvPath: "items.base", sourceType: "base", viewIndex: 0 }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "stage" }],
					measures: [{ column: "stage", function: "COUNT" }],
				},
			);

			const result = await analyticsService.runSavedQuery(saved.id);

			expect(result.rows.length).toBe(2); // active, planned
			const byStage = Object.fromEntries(
				result.rows.map((r) => [r["stage"], r["COUNT(stage)"]]),
			);
			expect(byStage["active"]).toBe(2);
			expect(byStage["planned"]).toBe(1);
		});

		it("should throw when base adapter is not configured", async () => {
			// Create new service without adapter
			const mock = createMockStorage<AnalyticsState>();
			const svc = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc.load();

			const saved = await svc.saveQuery(
				"No Adapter",
				[{ alias: "items", csvPath: "items.base", sourceType: "base", viewIndex: 0 }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "X", function: "COUNT" }] },
			);

			await expect(svc.runSavedQuery(saved.id)).rejects.toThrow("Base adapter not configured");
		});
	});

	// ── Provider stats ───────────────────────────────────────

	describe("provider stats", () => {
		it("should return correct counts when empty", async () => {
			await analyticsService.load();
			const provider = new AnalyticsHubProvider(analyticsService);

			const summary = provider.getSummary();
			expect(summary.stats).toHaveLength(2);
			expect(summary.stats[0]).toEqual({ label: "Queries", value: "0", icon: "search", tabId: "queries" });
			expect(summary.stats[1]).toEqual({ label: "Dashboards", value: "0", icon: "layout-grid", tabId: "dashboards" });
		});

		it("should reflect query and dashboard counts", async () => {
			await analyticsService.load();
			await analyticsService.saveQuery(
				"Q1", [{ alias: "s", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "X", function: "SUM" }] },
			);
			await analyticsService.createDashboard("D1");
			await analyticsService.createDashboard("D2");

			const provider = new AnalyticsHubProvider(analyticsService);
			const summary = provider.getSummary();

			expect(summary.stats[0].value).toBe("1"); // 1 query
			expect(summary.stats[1].value).toBe("2"); // 2 dashboards
		});

		it("should report correct hub identity", async () => {
			await analyticsService.load();
			const provider = new AnalyticsHubProvider(analyticsService);

			expect(provider.getHubId()).toBe("analytics");
			expect(provider.getDisplayName()).toBe("Analytics");
			expect(provider.getIcon()).toBe("bar-chart-2");
			expect(provider.getViewType()).toBe("flowti-analytics-hub");
		});
	});

	// ── Dashboard persistence ────────────────────────────────

	describe("dashboard persistence", () => {
		it("should persist dashboards and tiles across service instances", async () => {
			const mock = createMockStorage<AnalyticsState>();
			const svc1 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc1.load();

			const dashboard = await svc1.createDashboard("Persistent");
			await svc1.saveQuery(
				"Q", [{ alias: "s", csvPath: "a.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "X", function: "SUM" }] },
			);
			const queryId = svc1.listQueries()[0].id;
			await svc1.addTile(dashboard.id, queryId, "table", "My Tile");

			// New service instance, same storage
			const svc2 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc2.load();

			expect(svc2.listDashboards()).toHaveLength(1);
			expect(svc2.listDashboards()[0].name).toBe("Persistent");
			expect(svc2.listDashboards()[0].tiles).toHaveLength(1);
			expect(svc2.listDashboards()[0].tiles[0].title).toBe("My Tile");
			expect(svc2.listQueries()).toHaveLength(1);
		});
	});

	// ── Edge cases ───────────────────────────────────────────

	describe("edge cases", () => {
		beforeEach(async () => {
			await analyticsService.load();
		});

		it("should handle adding tile with nonexistent query ID gracefully", async () => {
			const dashboard = await analyticsService.createDashboard("D");
			const tile = await analyticsService.addTile(dashboard.id, "nonexistent-query", "table");

			// Tile is added (no validation on queryId at add time)
			expect(tile).toBeDefined();
		});

		it("should return undefined for tile update on nonexistent dashboard", async () => {
			const result = await analyticsService.updateTile("bad-id", "bad-tile", { title: "x" });
			expect(result).toBeUndefined();
		});

		it("should return false for tile removal on nonexistent dashboard", async () => {
			const result = await analyticsService.removeTile("bad-id", "bad-tile");
			expect(result).toBe(false);
		});

		it("should auto-position tiles in new rows", async () => {
			const dashboard = await analyticsService.createDashboard("Grid Test");
			const tile1 = await analyticsService.addTile(dashboard.id, "q1", "table");
			const tile2 = await analyticsService.addTile(dashboard.id, "q2", "stat-card");

			expect(tile1!.row).toBe(0);
			expect(tile2!.row).toBe(1); // Next row after first tile (height=1)
		});

		it("should update dashboard name and description", async () => {
			const dashboard = await analyticsService.createDashboard("Original", "Old desc");
			const updated = await analyticsService.updateDashboard(dashboard.id, {
				name: "Renamed",
				description: "New desc",
			});

			expect(updated!.name).toBe("Renamed");
			expect(updated!.description).toBe("New desc");
		});
	});
});
