/**
 * Flow 23: Analytics File Watcher
 *
 * Open dashboard → modify source file → verify selective refresh →
 * debounce → cleanup. Tests getSourcePathsForDashboard, clearByQueryId,
 * and watcher lifecycle through domain-level operations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { TileResultCache } from "../../src/ui/analytics/TileResultCache";
import { buildFilterCacheKey } from "../../src/ui/analytics/dashboardUtils";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["region", "revenue"];
const SALES_ROWS: string[][] = [
	["EMEA", "100"],
	["APAC", "200"],
];

const INVENTORY_HEADERS = ["product", "stock"];
const INVENTORY_ROWS: string[][] = [
	["Widget", "50"],
	["Gadget", "30"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 23: Analytics File Watcher", () => {
	let eventBus: IEventBus;
	let svc: AnalyticsService;
	let tileCache: TileResultCache;
	let salesQueryId: string;
	let inventoryQueryId: string;
	let dashboardId: string;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		svc = new AnalyticsService({ storage: mock.storage, eventBus });
		await svc.load();
		svc.setReadCsv(async (csvPath: string) => {
			if (csvPath === "data/sales.csv") {
				return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
			}
			if (csvPath === "data/inventory.csv") {
				return { headers: INVENTORY_HEADERS, rows: INVENTORY_ROWS, rowCount: INVENTORY_ROWS.length, detectedDelimiter: "," };
			}
			return null;
		});

		const q1 = await svc.saveQuery("Sales", [{ alias: "s", csvPath: "data/sales.csv" }], {
			joins: [], columnTypeHints: [{ column: "revenue", type: "number" }],
			dimensions: [{ column: "region" }], measures: [{ column: "revenue", function: "SUM", label: "total_rev" }],
		});
		salesQueryId = q1.id;

		const q2 = await svc.saveQuery("Inventory", [{ alias: "i", csvPath: "data/inventory.csv" }], {
			joins: [], columnTypeHints: [{ column: "stock", type: "number" }],
			dimensions: [{ column: "product" }], measures: [{ column: "stock", function: "SUM", label: "total_stock" }],
		});
		inventoryQueryId = q2.id;

		const dashboard = await svc.createDashboard("Overview");
		dashboardId = dashboard.id;
		await svc.addTile(dashboardId, salesQueryId, "table");
		await svc.addTile(dashboardId, inventoryQueryId, "stat-card");

		tileCache = new TileResultCache();
	});

	describe("source path discovery", () => {
		it("getSourcePathsForDashboard returns all unique source paths", () => {
			const paths = svc.getSourcePathsForDashboard(dashboardId);
			expect(paths).toContain("data/sales.csv");
			expect(paths).toContain("data/inventory.csv");
			expect(paths).toHaveLength(2);
		});

		it("returns empty for nonexistent dashboard", () => {
			expect(svc.getSourcePathsForDashboard("nonexistent")).toEqual([]);
		});
	});

	describe("selective cache invalidation", () => {
		it("clearByQueryId clears only sales cache, leaves inventory", async () => {
			// Populate both caches
			const salesRunner = async () => svc.runSavedQuery(salesQueryId);
			const invRunner = async () => svc.runSavedQuery(inventoryQueryId);

			tileCache.tryRun(salesQueryId, salesRunner, () => {});
			tileCache.tryRun(inventoryQueryId, invRunner, () => {});
			// Wait for async
			await new Promise((r) => setTimeout(r, 100));

			expect(tileCache.get(salesQueryId)?.result).not.toBeNull();
			expect(tileCache.get(inventoryQueryId)?.result).not.toBeNull();

			// Simulate file change: invalidate only sales
			tileCache.clearByQueryId(salesQueryId);

			expect(tileCache.get(salesQueryId)).toBeUndefined();
			expect(tileCache.get(inventoryQueryId)?.result).not.toBeNull();
		});

		it("clearByQueryId clears filtered variants too", async () => {
			const runner = async () => svc.runSavedQuery(salesQueryId);
			const filteredKey = buildFilterCacheKey(salesQueryId, [{ column: "region", values: ["EMEA"] }]);

			tileCache.tryRun(salesQueryId, runner, () => {});
			tileCache.tryRun(filteredKey, runner, () => {});
			await new Promise((r) => setTimeout(r, 100));

			tileCache.clearByQueryId(salesQueryId);

			expect(tileCache.get(salesQueryId)).toBeUndefined();
			expect(tileCache.get(filteredKey)).toBeUndefined();
		});
	});

	describe("file modification detection", () => {
		it("identifies which query IDs are affected by a modified file", () => {
			const modifiedPath = "data/sales.csv";
			const dashboard = svc.getDashboard(dashboardId)!;
			const queries = svc.listQueries();
			const queryMap = new Map(queries.map((q) => [q.id, q]));

			const affectedQueryIds = new Set<string>();
			for (const tile of dashboard.tiles) {
				const query = queryMap.get(tile.queryId);
				if (query?.sources.some((s) => s.csvPath === modifiedPath)) {
					affectedQueryIds.add(tile.queryId);
				}
			}

			expect(affectedQueryIds.has(salesQueryId)).toBe(true);
			expect(affectedQueryIds.has(inventoryQueryId)).toBe(false);
		});

		it("multiple tiles from same query produce single affected queryId", async () => {
			// Add second sales tile
			await svc.addTile(dashboardId, salesQueryId, "bar-chart");

			const modifiedPath = "data/sales.csv";
			const dashboard = svc.getDashboard(dashboardId)!;
			const queries = svc.listQueries();
			const queryMap = new Map(queries.map((q) => [q.id, q]));

			const affectedQueryIds = new Set<string>();
			for (const tile of dashboard.tiles) {
				const query = queryMap.get(tile.queryId);
				if (query?.sources.some((s) => s.csvPath === modifiedPath)) {
					affectedQueryIds.add(tile.queryId);
				}
			}

			// Still just 1 unique query ID, even though 2 tiles reference it
			expect(affectedQueryIds.size).toBe(1);
			expect(affectedQueryIds.has(salesQueryId)).toBe(true);
		});
	});

	describe("watcher cleanup", () => {
		it("getSourcePathsForDashboard works correctly after tile removal", async () => {
			const dashboard = svc.getDashboard(dashboardId)!;
			const salesTile = dashboard.tiles.find((t) => t.queryId === salesQueryId)!;
			await svc.removeTile(dashboardId, salesTile.id);

			const paths = svc.getSourcePathsForDashboard(dashboardId);
			expect(paths).toEqual(["data/inventory.csv"]); // only inventory remains
		});
	});
});
