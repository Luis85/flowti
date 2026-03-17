/**
 * Flow 29: Analytics Hub — Supplier Manager Experience
 *
 * End-to-end integration test covering the Supplier Manager daily workflow:
 * - Favorites foundation (toggle, sort, persistence)
 * - Default dashboard (set, get, clear)
 * - TileResultCache (tryRun, clear, clearOne)
 * - Event emission for all new v2 events
 *
 * Event sequence:
 *   analytics.loaded → analytics.query.saved → analytics.dashboard.created →
 *   analytics.dashboard.favorited → analytics.query.favorited →
 *   analytics.dashboard.defaultChanged → analytics.dashboard.tile.added
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { TileResultCache } from "../../src/ui/analytics/TileResultCache";
import { createMockStorage, collectEvents } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["Category", "Amount"];
const SALES_ROWS: string[][] = [
	["Electronics", "500"],
	["Books", "150"],
	["Electronics", "300"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 29: Analytics Supplier Manager", () => {
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

	// ── Favorites foundation ─────────────────────────────────

	describe("favorites foundation", () => {
		it("should toggle dashboard favorite on and off", async () => {
			const dashboard = await analyticsService.createDashboard("Daily Metrics");
			expect(dashboard.isFavorite).toBeFalsy();

			await analyticsService.toggleDashboardFavorite(dashboard.id);
			const toggled = analyticsService.getDashboard(dashboard.id);
			expect(toggled!.isFavorite).toBe(true);

			await analyticsService.toggleDashboardFavorite(dashboard.id);
			const untoggled = analyticsService.getDashboard(dashboard.id);
			expect(untoggled!.isFavorite).toBe(false);
		});

		it("should toggle query favorite on and off", async () => {
			const saved = await analyticsService.saveQuery(
				"Monthly Sales",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [{ column: "Amount", type: "number" }], dimensions: [{ column: "Category" }], measures: [{ column: "Amount", function: "SUM" }] },
			);
			expect(saved.isFavorite).toBeFalsy();

			await analyticsService.toggleQueryFavorite(saved.id);
			const toggled = analyticsService.getQuery(saved.id);
			expect(toggled!.isFavorite).toBe(true);

			await analyticsService.toggleQueryFavorite(saved.id);
			const untoggled = analyticsService.getQuery(saved.id);
			expect(untoggled!.isFavorite).toBe(false);
		});

		it("should emit analytics.dashboard.favorited event", async () => {
			const events = collectEvents(eventBus, "*");
			const dashboard = await analyticsService.createDashboard("D");

			await analyticsService.toggleDashboardFavorite(dashboard.id);

			expect(events).toContain("analytics.dashboard.favorited");
		});

		it("should emit analytics.query.favorited event", async () => {
			const events = collectEvents(eventBus, "*");
			const saved = await analyticsService.saveQuery(
				"Q", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			await analyticsService.toggleQueryFavorite(saved.id);

			expect(events).toContain("analytics.query.favorited");
		});

		it("should persist favorites across service instances", async () => {
			const mock = createMockStorage<AnalyticsState>();
			const svc1 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc1.load();

			const dashboard = await svc1.createDashboard("Fav Dashboard");
			await svc1.toggleDashboardFavorite(dashboard.id);

			const saved = await svc1.saveQuery(
				"Fav Query", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			await svc1.toggleQueryFavorite(saved.id);

			// New service instance, same storage
			const svc2 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc2.load();

			expect(svc2.listDashboards()[0].isFavorite).toBe(true);
			expect(svc2.listQueries()[0].isFavorite).toBe(true);
		});
	});

	// ── Default dashboard ────────────────────────────────────

	describe("default dashboard", () => {
		it("should set and get default dashboard", async () => {
			const dashboard = await analyticsService.createDashboard("Default Board");

			await analyticsService.setDefaultDashboard(dashboard.id);
			const def = analyticsService.getDefaultDashboard();
			expect(def).toBeDefined();
			expect(def!.id).toBe(dashboard.id);
			expect(def!.name).toBe("Default Board");
		});

		it("should clear default dashboard with null", async () => {
			const dashboard = await analyticsService.createDashboard("D");
			await analyticsService.setDefaultDashboard(dashboard.id);

			await analyticsService.setDefaultDashboard(null);
			expect(analyticsService.getDefaultDashboard()).toBeUndefined();
		});

		it("should emit analytics.dashboard.defaultChanged event", async () => {
			const events = collectEvents(eventBus, "*");
			const dashboard = await analyticsService.createDashboard("D");

			await analyticsService.setDefaultDashboard(dashboard.id);

			expect(events).toContain("analytics.dashboard.defaultChanged");
		});

		it("should clear default when default dashboard is deleted", async () => {
			const dashboard = await analyticsService.createDashboard("To Delete");
			await analyticsService.setDefaultDashboard(dashboard.id);
			expect(analyticsService.getDefaultDashboard()).toBeDefined();

			await analyticsService.deleteDashboard(dashboard.id);
			expect(analyticsService.getDefaultDashboard()).toBeUndefined();
		});

		it("should return undefined for nonexistent default dashboard ID", async () => {
			// State may have stale ID (edge case)
			expect(analyticsService.getDefaultDashboard()).toBeUndefined();
		});

		it("should persist default dashboard across service instances", async () => {
			const mock = createMockStorage<AnalyticsState>();
			const svc1 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc1.load();

			const dashboard = await svc1.createDashboard("Persisted Default");
			await svc1.setDefaultDashboard(dashboard.id);

			const svc2 = new AnalyticsService({ storage: mock.storage, eventBus });
			await svc2.load();

			const def = svc2.getDefaultDashboard();
			expect(def).toBeDefined();
			expect(def!.name).toBe("Persisted Default");
		});
	});

	// ── TileResultCache ──────────────────────────────────────

	describe("TileResultCache", () => {
		it("should return loading state on first tryRun", () => {
			const cache = new TileResultCache();
			const entry = cache.tryRun(
				"q1",
				async () => ({ columns: ["a"], rows: [{ a: 1 }], rowCount: 1, groupCount: 1, sourceRowCount: 1 }),
				() => {},
			);

			expect(entry.result).toBeNull();
			expect(entry.error).toBeNull();
		});

		it("should return cached result after async completion", async () => {
			const cache = new TileResultCache();
			let onDoneCalled = false;

			cache.tryRun(
				"q1",
				async () => ({ columns: ["a"], rows: [{ a: 1 }], rowCount: 1, groupCount: 1, sourceRowCount: 1 }),
				() => { onDoneCalled = true; },
			);

			// Wait for async execution
			await new Promise((r) => setTimeout(r, 50));

			expect(onDoneCalled).toBe(true);
			const entry = cache.get("q1");
			expect(entry).toBeDefined();
			expect(entry!.result).toBeDefined();
			expect(entry!.result!.rows).toHaveLength(1);
		});

		it("should cache errors", async () => {
			const cache = new TileResultCache();

			cache.tryRun(
				"q1",
				async () => { throw new Error("Query failed"); },
				() => {},
			);

			await new Promise((r) => setTimeout(r, 50));

			const entry = cache.get("q1");
			expect(entry).toBeDefined();
			expect(entry!.error).toBe("Query failed");
			expect(entry!.result).toBeNull();
		});

		it("should return cached entry on second tryRun without re-executing", async () => {
			const cache = new TileResultCache();
			let runCount = 0;

			const runner = async () => {
				runCount++;
				return { columns: ["a"], rows: [{ a: 1 }], rowCount: 1, groupCount: 1, sourceRowCount: 1 };
			};

			cache.tryRun("q1", runner, () => {});
			await new Promise((r) => setTimeout(r, 50));

			cache.tryRun("q1", runner, () => {});
			expect(runCount).toBe(1); // Only executed once
		});

		it("should clear all entries", async () => {
			const cache = new TileResultCache();

			cache.tryRun("q1", async () => ({ columns: [], rows: [], rowCount: 0, groupCount: 0, sourceRowCount: 0 }), () => {});
			cache.tryRun("q2", async () => ({ columns: [], rows: [], rowCount: 0, groupCount: 0, sourceRowCount: 0 }), () => {});
			await new Promise((r) => setTimeout(r, 50));

			cache.clear();
			expect(cache.get("q1")).toBeUndefined();
			expect(cache.get("q2")).toBeUndefined();
		});

		it("should clear a single entry (for per-tile refresh)", async () => {
			const cache = new TileResultCache();

			cache.tryRun("q1", async () => ({ columns: [], rows: [], rowCount: 0, groupCount: 0, sourceRowCount: 0 }), () => {});
			cache.tryRun("q2", async () => ({ columns: [], rows: [], rowCount: 0, groupCount: 0, sourceRowCount: 0 }), () => {});
			await new Promise((r) => setTimeout(r, 50));

			cache.clearOne("q1");
			expect(cache.get("q1")).toBeUndefined();
			expect(cache.get("q2")).toBeDefined();
		});
	});

	// ── Full Supplier Manager workflow ───────────────────────

	describe("full Supplier Manager workflow", () => {
		it("should complete: create → name → add tiles → set default → favorite → refresh", async () => {
			const events = collectEvents(eventBus, "*");

			// 1. Save a query (simulating existing saved query)
			const saved = await analyticsService.saveQuery(
				"Sales per Category",
				[{ alias: "sales", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "Amount", type: "number" }],
					dimensions: [{ column: "Category" }],
					measures: [{ column: "Amount", function: "SUM" }],
				},
			);

			// 2. Create a named dashboard
			const dashboard = await analyticsService.createDashboard("Supplier KPIs");
			expect(dashboard.name).toBe("Supplier KPIs");

			// 3. Add tile
			const tile = await analyticsService.addTile(dashboard.id, saved.id, "stat-card", "Category Sales");
			expect(tile).toBeDefined();

			// 4. Set as default
			await analyticsService.setDefaultDashboard(dashboard.id);
			const defaultDash = analyticsService.getDefaultDashboard();
			expect(defaultDash!.id).toBe(dashboard.id);

			// 5. Favorite the dashboard
			await analyticsService.toggleDashboardFavorite(dashboard.id);
			expect(analyticsService.getDashboard(dashboard.id)!.isFavorite).toBe(true);

			// 6. Favorite the query
			await analyticsService.toggleQueryFavorite(saved.id);
			expect(analyticsService.getQuery(saved.id)!.isFavorite).toBe(true);

			// 7. Simulate tile refresh via cache
			const cache = new TileResultCache();
			cache.tryRun(
				saved.id,
				(id) => analyticsService.runSavedQuery(id),
				() => {},
			);
			await new Promise((r) => setTimeout(r, 100));

			const entry = cache.get(saved.id);
			expect(entry).toBeDefined();
			expect(entry!.result).toBeDefined();
			expect(entry!.result!.rows).toHaveLength(2); // Electronics, Books

			// 8. Per-tile refresh: clear one, re-run
			cache.clearOne(saved.id);
			expect(cache.get(saved.id)).toBeUndefined();

			cache.tryRun(
				saved.id,
				(id) => analyticsService.runSavedQuery(id),
				() => {},
			);
			await new Promise((r) => setTimeout(r, 100));
			expect(cache.get(saved.id)!.result!.rows).toHaveLength(2);

			// 9. Verify event sequence
			const analyticsEvents = events.filter((e) => e.startsWith("analytics."));
			expect(analyticsEvents).toContain("analytics.query.saved");
			expect(analyticsEvents).toContain("analytics.dashboard.created");
			expect(analyticsEvents).toContain("analytics.dashboard.tile.added");
			expect(analyticsEvents).toContain("analytics.dashboard.defaultChanged");
			expect(analyticsEvents).toContain("analytics.dashboard.favorited");
			expect(analyticsEvents).toContain("analytics.query.favorited");
		});

		it("should sort favorites first in dashboard list", async () => {
			const d1 = await analyticsService.createDashboard("Alpha");
			const d2 = await analyticsService.createDashboard("Beta");
			await analyticsService.createDashboard("Gamma");

			await analyticsService.toggleDashboardFavorite(d2.id);

			const dashboards = analyticsService.listDashboards();
			// Sort favorites first (same logic as DashboardsTab)
			const sorted = [...dashboards].sort((a, b) => {
				if (a.isFavorite && !b.isFavorite) return -1;
				if (!a.isFavorite && b.isFavorite) return 1;
				return 0;
			});

			expect(sorted[0].name).toBe("Beta");
			expect(sorted[0].isFavorite).toBe(true);
		});

		it("should sort favorites first in query list", async () => {
			const q1 = await analyticsService.saveQuery(
				"Alpha Query", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);
			await analyticsService.saveQuery(
				"Beta Query", [{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Amount", function: "SUM" }] },
			);

			await analyticsService.toggleQueryFavorite(q1.id);

			const queries = analyticsService.listQueries();
			const sorted = [...queries].sort((a, b) => {
				if (a.isFavorite && !b.isFavorite) return -1;
				if (!a.isFavorite && b.isFavorite) return 1;
				return 0;
			});

			expect(sorted[0].name).toBe("Alpha Query");
			expect(sorted[0].isFavorite).toBe(true);
		});
	});
});
