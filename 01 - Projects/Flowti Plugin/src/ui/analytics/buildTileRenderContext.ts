/**
 * Pure function to build the per-tile rendering context (query resolution,
 * filter merging, cache key computation).
 *
 * Extracted from DashboardsTab (TD-128, Cycle 49) to enable independent testing
 * and reuse in AnalyticsDashboardPage.
 */

import type { Measurement, QueryDateRangeFilter, SavedAnalyticsQuery } from "../../domain/analytics/types";
import { resolveDateRangeFilter } from "../../domain/analytics/dateUtils";
import type { DashboardTile, CrossTileFilter } from "../../domain/analytics/types";
import type { DashboardFilter } from "./types";
import { buildFilterCacheKey, mergeCrossTileFilter } from "./dashboardUtils";

export interface TileContextInput {
	tile: DashboardTile;
	measurements: Measurement[];
	queries: SavedAnalyticsQuery[];
	dashboardFilters: DashboardFilter[];
	crossTileFilter: CrossTileFilter | null;
	dateRangeFilter: import("../../domain/analytics/types").DateRangeFilter | null;
}

export interface TileContextResult {
	effectiveQueryId: string;
	measurement: Measurement | undefined;
	query: SavedAnalyticsQuery | undefined;
	effectiveFilters: DashboardFilter[];
	resolvedDateRange: QueryDateRangeFilter | null;
	cacheKey: string;
	hasFilters: boolean;
}

/**
 * Compute the derived tile rendering context from state.
 *
 * - Resolves the effective queryId (measurement's queryId takes precedence)
 * - Merges cross-tile filter into dashboard dimension filters
 * - Resolves date range filter against query column type hints
 * - Builds the cache key incorporating all active filters
 */
export function buildTileRenderContext(input: TileContextInput): TileContextResult {
	const { tile, measurements, queries, dashboardFilters, crossTileFilter, dateRangeFilter } = input;

	// Resolve effective queryId: measurement's queryId takes precedence
	let effectiveQueryId = tile.queryId;
	const measurement = tile.measurementId
		? measurements.find((m) => m.id === tile.measurementId)
		: undefined;
	if (measurement) effectiveQueryId = measurement.queryId;

	const query = queries.find((q) => q.id === effectiveQueryId);

	// Merge cross-tile filter into dimension filters for query execution
	const effectiveFilters = crossTileFilter
		? mergeCrossTileFilter(dashboardFilters, crossTileFilter)
		: dashboardFilters;

	const resolvedDateRange = dateRangeFilter && query
		? resolveDateRangeFilter(dateRangeFilter, query.columnTypeHints)
		: null;

	const cacheKey = buildFilterCacheKey(effectiveQueryId, effectiveFilters, resolvedDateRange);
	const hasFilters = effectiveFilters.length > 0 || resolvedDateRange !== null;

	return {
		effectiveQueryId,
		measurement,
		query,
		effectiveFilters,
		resolvedDateRange,
		cacheKey,
		hasFilters,
	};
}
