import { describe, it, expect } from "vitest";
import { buildFilterCacheKey, discoverDateColumns, mergeCrossTileFilter } from "../../../src/ui/analytics/DashboardsTab";
import type { DashboardTile, SavedAnalyticsQuery } from "../../../src/domain/analytics/types";

describe("buildFilterCacheKey", () => {
	it("returns queryId when no filters or date range", () => {
		expect(buildFilterCacheKey("q-1", [])).toBe("q-1");
	});

	it("includes dimension filter suffix", () => {
		const key = buildFilterCacheKey("q-1", [{ column: "region", values: ["EMEA"] }]);
		expect(key).toBe("q-1?region=EMEA");
	});

	it("includes date range suffix", () => {
		const key = buildFilterCacheKey("q-1", [], {
			column: "date",
			start: { year: 2026, month: 1, day: 1 },
			end: { year: 2026, month: 1, day: 31 },
		});
		expect(key).toBe("q-1?dr=date:2026-1-1..2026-1-31");
	});

	it("combines dimension filters and date range", () => {
		const key = buildFilterCacheKey(
			"q-1",
			[{ column: "region", values: ["EMEA"] }],
			{
				column: "date",
				start: { year: 2026, month: 2, day: 1 },
				end: { year: 2026, month: 2, day: 28 },
			},
		);
		expect(key).toContain("region=EMEA");
		expect(key).toContain("dr=date:2026-2-1..2026-2-28");
	});

	it("returns queryId when date range is null", () => {
		expect(buildFilterCacheKey("q-1", [], null)).toBe("q-1");
	});
});

describe("discoverDateColumns", () => {
	const queries: SavedAnalyticsQuery[] = [
		{
			id: "q-1",
			name: "Sales",
			createdAt: Date.now(),
			sources: [],
			joins: [],
			columnTypeHints: [
				{ column: "date", type: "date" },
				{ column: "amount", type: "number" },
				{ column: "region", type: "string" },
			],
			dimensions: [],
			measures: [],
		},
		{
			id: "q-2",
			name: "Inventory",
			createdAt: Date.now(),
			sources: [],
			joins: [],
			columnTypeHints: [
				{ column: "order_date", type: "date" },
				{ column: "quantity", type: "number" },
			],
			dimensions: [],
			measures: [],
		},
	];

	const tiles: DashboardTile[] = [
		{ id: "t-1", queryId: "q-1", displayMode: "table", row: 1, col: 1, width: 3, height: 2 },
		{ id: "t-2", queryId: "q-2", displayMode: "stat-card", row: 1, col: 4, width: 3, height: 2 },
	];

	it("discovers date columns from all tile queries", () => {
		const cols = discoverDateColumns(tiles, queries);
		expect(cols).toContain("date");
		expect(cols).toContain("order_date");
		expect(cols).toHaveLength(2);
	});

	it("de-duplicates date columns across tiles referencing same query", () => {
		const tilesWithDupe: DashboardTile[] = [
			{ id: "t-1", queryId: "q-1", displayMode: "table", row: 1, col: 1, width: 3, height: 2 },
			{ id: "t-2", queryId: "q-1", displayMode: "stat-card", row: 1, col: 4, width: 3, height: 2 },
		];
		const cols = discoverDateColumns(tilesWithDupe, queries);
		expect(cols).toHaveLength(1);
		expect(cols[0]).toBe("date");
	});

	it("returns empty array when no date columns", () => {
		const noDateQueries: SavedAnalyticsQuery[] = [{
			id: "q-1",
			name: "Numbers",
			createdAt: Date.now(),
			sources: [],
			joins: [],
			columnTypeHints: [{ column: "amount", type: "number" }],
			dimensions: [],
			measures: [],
		}];
		const cols = discoverDateColumns(tiles.slice(0, 1), noDateQueries);
		expect(cols).toHaveLength(0);
	});

	it("skips tiles with unknown queries", () => {
		const unknownTiles: DashboardTile[] = [
			{ id: "t-x", queryId: "nonexistent", displayMode: "table", row: 1, col: 1, width: 3, height: 2 },
		];
		const cols = discoverDateColumns(unknownTiles, queries);
		expect(cols).toHaveLength(0);
	});
});

describe("mergeCrossTileFilter", () => {
	it("returns filters unchanged when crossFilter is null", () => {
		const filters = [{ column: "region", values: ["EMEA"] }];
		expect(mergeCrossTileFilter(filters, null)).toEqual(filters);
	});

	it("adds cross-tile filter as new column", () => {
		const filters = [{ column: "region", values: ["EMEA"] }];
		const cross = { sourceTileId: "t-1", column: "status", value: "Active" };
		const result = mergeCrossTileFilter(filters, cross);
		expect(result).toHaveLength(2);
		expect(result.find((f) => f.column === "status")?.values).toEqual(["Active"]);
	});

	it("merges cross-tile filter into existing column", () => {
		const filters = [{ column: "region", values: ["EMEA"] }];
		const cross = { sourceTileId: "t-1", column: "region", value: "APAC" };
		const result = mergeCrossTileFilter(filters, cross);
		expect(result).toHaveLength(1);
		expect(result[0].values).toEqual(["EMEA", "APAC"]);
	});

	it("does not duplicate existing value in same column", () => {
		const filters = [{ column: "region", values: ["EMEA"] }];
		const cross = { sourceTileId: "t-1", column: "region", value: "EMEA" };
		const result = mergeCrossTileFilter(filters, cross);
		expect(result[0].values).toEqual(["EMEA"]);
	});

	it("does not mutate original filters array", () => {
		const filters = [{ column: "region", values: ["EMEA"] }];
		const cross = { sourceTileId: "t-1", column: "region", value: "APAC" };
		mergeCrossTileFilter(filters, cross);
		expect(filters[0].values).toEqual(["EMEA"]);
	});

	it("merges into empty filters array", () => {
		const cross = { sourceTileId: "t-1", column: "status", value: "Active" };
		const result = mergeCrossTileFilter([], cross);
		expect(result).toEqual([{ column: "status", values: ["Active"] }]);
	});
});
