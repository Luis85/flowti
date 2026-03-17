import { describe, it, expect } from "vitest";
import { buildTileRenderContext } from "../../../src/ui/analytics/buildTileRenderContext";
import type { DashboardTile, Measurement, SavedAnalyticsQuery } from "../../../src/domain/analytics/types";

function createTile(overrides: Partial<DashboardTile> = {}): DashboardTile {
	return {
		id: "tile-1",
		queryId: "query-1",
		displayMode: "table",
		width: 3,
		height: 2,
		title: "Test",
		...overrides,
	} as DashboardTile;
}

function createQuery(overrides: Partial<SavedAnalyticsQuery> = {}): SavedAnalyticsQuery {
	return {
		id: "query-1",
		name: "Test Query",
		sources: [],
		columns: [],
		dimensions: [],
		aggregations: [],
		columnTypeHints: [],
		...overrides,
	} as SavedAnalyticsQuery;
}

function createMeasurement(overrides: Partial<Measurement> = {}): Measurement {
	return {
		id: "meas-1",
		name: "Test Measure",
		queryId: "query-2",
		type: "single",
		measureColumn: "amount",
		...overrides,
	} as Measurement;
}

describe("buildTileRenderContext", () => {
	it("resolves effectiveQueryId from tile when no measurement", () => {
		const tile = createTile({ queryId: "q-42" });
		const result = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [createQuery({ id: "q-42" })],
			dashboardFilters: [],
			crossTileFilter: null,
			dateRangeFilter: null,
		});

		expect(result.effectiveQueryId).toBe("q-42");
		expect(result.measurement).toBeUndefined();
		expect(result.query?.id).toBe("q-42");
	});

	it("resolves effectiveQueryId from measurement when present", () => {
		const tile = createTile({ queryId: "q-1", measurementId: "meas-1" });
		const measurement = createMeasurement({ id: "meas-1", queryId: "q-override" });
		const result = buildTileRenderContext({
			tile,
			measurements: [measurement],
			queries: [createQuery({ id: "q-1" }), createQuery({ id: "q-override" })],
			dashboardFilters: [],
			crossTileFilter: null,
			dateRangeFilter: null,
		});

		expect(result.effectiveQueryId).toBe("q-override");
		expect(result.measurement).toBe(measurement);
		expect(result.query?.id).toBe("q-override");
	});

	it("merges cross-tile filter into effective filters", () => {
		const tile = createTile();
		const result = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [createQuery()],
			dashboardFilters: [{ column: "type", values: ["bug"] }],
			crossTileFilter: { sourceTileId: "t-2", column: "status", value: "open" },
			dateRangeFilter: null,
		});

		expect(result.effectiveFilters).toEqual([
			{ column: "type", values: ["bug"] },
			{ column: "status", values: ["open"] },
		]);
		expect(result.hasFilters).toBe(true);
	});

	it("returns no filters when none are active", () => {
		const tile = createTile();
		const result = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [createQuery()],
			dashboardFilters: [],
			crossTileFilter: null,
			dateRangeFilter: null,
		});

		expect(result.effectiveFilters).toEqual([]);
		expect(result.hasFilters).toBe(false);
	});

	it("builds a unique cache key incorporating filters", () => {
		const tile = createTile({ queryId: "q-1" });
		const withFilters = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [createQuery({ id: "q-1" })],
			dashboardFilters: [{ column: "status", values: ["open"] }],
			crossTileFilter: null,
			dateRangeFilter: null,
		});
		const withoutFilters = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [createQuery({ id: "q-1" })],
			dashboardFilters: [],
			crossTileFilter: null,
			dateRangeFilter: null,
		});

		expect(withFilters.cacheKey).not.toBe(withoutFilters.cacheKey);
		expect(withFilters.cacheKey).toContain("q-1");
		expect(withFilters.cacheKey).toContain("status");
	});

	it("resolves date range filter from query column type hints", () => {
		const tile = createTile({ queryId: "q-1" });
		const query = createQuery({
			id: "q-1",
			columnTypeHints: [{ column: "date", type: "date" as const }],
		});
		const result = buildTileRenderContext({
			tile,
			measurements: [],
			queries: [query],
			dashboardFilters: [],
			crossTileFilter: null,
			dateRangeFilter: {
				column: "date",
				preset: "last-7-days",
			},
		});

		expect(result.hasFilters).toBe(true);
		expect(result.resolvedDateRange).not.toBeNull();
	});
});
