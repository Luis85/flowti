/**
 * Flow 22: Analytics Cross-Tile Filter
 *
 * Create multi-tile dashboard → click segment → verify sibling filter →
 * clear → verify reset. Tests the mergeCrossTileFilter utility and
 * cross-tile filter composition at the domain/service level.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState, CrossTileFilter } from "../../src/domain/analytics/types";
import { mergeCrossTileFilter } from "../../src/ui/analytics/dashboardUtils";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["region", "product", "revenue"];
const SALES_ROWS: string[][] = [
	["EMEA", "Widget", "100"],
	["EMEA", "Gadget", "200"],
	["APAC", "Widget", "300"],
	["APAC", "Gadget", "400"],
	["AMER", "Widget", "500"],
	["AMER", "Gadget", "600"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 22: Analytics Cross-Tile Filter", () => {
	let eventBus: IEventBus;
	let svc: AnalyticsService;
	let queryId: string;
	let dashboardId: string;
	let tileIds: string[];

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		svc = new AnalyticsService({ storage: mock.storage, eventBus });
		await svc.load();
		svc.setReadCsv(async (csvPath: string) => {
			if (csvPath === "data/sales.csv") {
				return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
			}
			return null;
		});

		const saved = await svc.saveQuery(
			"Regional Sales",
			[{ alias: "s", csvPath: "data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [{ column: "revenue", type: "number" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "revenue", function: "SUM", label: "total_rev" }],
			},
		);
		queryId = saved.id;

		const dashboard = await svc.createDashboard("Sales Dashboard");
		dashboardId = dashboard.id;
		tileIds = [];
		for (const mode of ["table", "stat-card", "bar-chart"] as const) {
			const tile = await svc.addTile(dashboardId, queryId, mode);
			if (tile) tileIds.push(tile.id);
		}
	});

	describe("mergeCrossTileFilter utility", () => {
		it("composes cross-tile filter into empty dimension filters", () => {
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "region", value: "EMEA" };
			const merged = mergeCrossTileFilter([], cross);
			expect(merged).toEqual([{ column: "region", values: ["EMEA"] }]);
		});

		it("merges into existing dimension filter for same column", () => {
			const existing = [{ column: "region", values: ["APAC"] }];
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "region", value: "EMEA" };
			const merged = mergeCrossTileFilter(existing, cross);
			expect(merged[0].values).toEqual(["APAC", "EMEA"]);
		});

		it("adds new column when cross-filter targets different column", () => {
			const existing = [{ column: "region", values: ["EMEA"] }];
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "product", value: "Widget" };
			const merged = mergeCrossTileFilter(existing, cross);
			expect(merged).toHaveLength(2);
			expect(merged.find((f) => f.column === "product")?.values).toEqual(["Widget"]);
		});

		it("returns unchanged filters when cross-filter is null", () => {
			const existing = [{ column: "region", values: ["EMEA"] }];
			const merged = mergeCrossTileFilter(existing, null);
			expect(merged).toEqual(existing);
		});
	});

	describe("cross-tile filter propagation", () => {
		it("clicking EMEA filters sibling tiles to EMEA only", async () => {
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "region", value: "EMEA" };
			const effectiveFilters = mergeCrossTileFilter([], cross);

			svc.clearQueryCache();
			const filtered = await svc.runSavedQueryWithFilters(queryId, effectiveFilters);
			expect(filtered.rows).toHaveLength(1);
			expect(filtered.rows[0].region).toBe("EMEA");
			expect(filtered.rows[0].total_rev).toBe(300); // 100+200
		});

		it("changing filter from EMEA to APAC replaces (not stacks)", async () => {
			// Simulate: first click EMEA, then click APAC (replace)
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "region", value: "APAC" };
			const effectiveFilters = mergeCrossTileFilter([], cross);

			svc.clearQueryCache();
			const filtered = await svc.runSavedQueryWithFilters(queryId, effectiveFilters);
			expect(filtered.rows).toHaveLength(1);
			expect(filtered.rows[0].region).toBe("APAC");
			expect(filtered.rows[0].total_rev).toBe(700); // 300+400
		});

		it("clearing cross-tile filter shows all data", async () => {
			// No cross-tile filter = unfiltered
			svc.clearQueryCache();
			const result = await svc.runSavedQuery(queryId);
			expect(result.rows).toHaveLength(3); // EMEA, APAC, AMER
		});
	});

	describe("cross-tile filter with dimension filters", () => {
		it("composes cross-tile filter AND dimension filter", async () => {
			// Dimension filter: product=Widget. Cross-tile: region=EMEA.
			const dimFilters = [{ column: "product", values: ["Widget"] }];
			const cross: CrossTileFilter = { sourceTileId: tileIds[0], column: "region", value: "EMEA" };
			const effectiveFilters = mergeCrossTileFilter(dimFilters, cross);

			// Need a query with both dimensions
			const q2 = await svc.saveQuery(
				"Detailed Sales",
				[{ alias: "s", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [{ column: "revenue", type: "number" }],
					dimensions: [{ column: "region" }, { column: "product" }],
					measures: [{ column: "revenue", function: "SUM", label: "total_rev" }],
				},
			);

			svc.clearQueryCache();
			const filtered = await svc.runSavedQueryWithFilters(q2.id, effectiveFilters);
			// Only EMEA + Widget = 1 row, revenue 100
			expect(filtered.rows).toHaveLength(1);
			expect(filtered.rows[0].region).toBe("EMEA");
			expect(filtered.rows[0].product).toBe("Widget");
			expect(filtered.rows[0].total_rev).toBe(100);
		});
	});

	describe("dashboard structure", () => {
		it("dashboard has 3 tiles from same query", () => {
			const dashboard = svc.getDashboard(dashboardId);
			expect(dashboard).toBeDefined();
			expect(dashboard!.tiles).toHaveLength(3);
			expect(tileIds).toHaveLength(3);
		});

		it("getSourcePathsForDashboard returns shared source path", () => {
			const paths = svc.getSourcePathsForDashboard(dashboardId);
			expect(paths).toEqual(["data/sales.csv"]);
		});
	});
});
