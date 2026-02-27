/**
 * Pure utility functions for dashboard rendering.
 *
 * Extracted from DashboardsTab (TD-128, Cycle 49) for independent testing
 * and reuse across DashboardsTab, AnalyticsDashboardPage, DashboardFilterBar,
 * and buildTileRenderContext.
 */

import type {
	AnalyticsResult,
	CrossTileFilter,
	Dashboard,
	DashboardTile,
	Measurement,
	QueryDateRangeFilter,
	ResultRow,
	SavedAnalyticsQuery,
} from "../../domain/analytics/types";

// ── Filter dimension discovery ───────────────────────────────

export interface FilterDimension {
	column: string;
	values: string[];
}

/**
 * Scan all tile results to discover string columns suitable for filtering.
 * Returns dimensions sorted by value count ascending (fewer values = more useful filter).
 * Maximum 4 dimensions returned.
 *
 * When `activeFilterColumns` is provided, columns that are already being filtered
 * are kept even if they have only 1 unique value in the (cascaded) filtered data.
 */
export function discoverFilterDimensions(
	tiles: Dashboard["tiles"],
	getResult: (queryId: string) => AnalyticsResult | null,
	activeFilterColumns?: string[],
): FilterDimension[] {
	const columnValues = new Map<string, Set<string>>();

	for (const tile of tiles) {
		const result = getResult(tile.queryId);
		if (!result || result.rows.length === 0) continue;

		for (const col of result.columns) {
			const firstVal = result.rows[0][col];
			if (typeof firstVal === "number") continue; // Skip numeric columns

			if (!columnValues.has(col)) columnValues.set(col, new Set());
			const valSet = columnValues.get(col)!;
			for (const row of result.rows) {
				const val = row[col];
				if (val != null) valSet.add(String(val));
			}
		}
	}

	// Sort by value count ascending (fewer values = better filter)
	const activeSet = new Set(activeFilterColumns ?? []);
	const dimensions: FilterDimension[] = [];
	for (const [column, vals] of columnValues) {
		// Keep actively-filtered columns even with 1 value (cascading); others need ≥2
		if (vals.size >= 2 || activeSet.has(column)) {
			dimensions.push({ column, values: [...vals].sort() });
		}
	}

	dimensions.sort((a, b) => a.values.length - b.values.length);
	return dimensions.slice(0, 4);
}

// ── Cache key builder ────────────────────────────────────────

/**
 * Build a cache key that incorporates active dashboard filters.
 * When filters change, old cached results are automatically bypassed.
 */
export function buildFilterCacheKey(
	queryId: string,
	filters: Array<{ column: string; values: string[] }>,
	dateRange?: QueryDateRangeFilter | null,
): string {
	let key = queryId;
	if (filters.length > 0) {
		const suffix = filters
			.map((f) => `${f.column}=${[...f.values].sort().join(",")}`)
			.sort()
			.join("&");
		key += `?${suffix}`;
	}
	if (dateRange) {
		const dSuffix = `dr=${dateRange.column}:${dateRange.start.year}-${dateRange.start.month}-${dateRange.start.day}..${dateRange.end.year}-${dateRange.end.month}-${dateRange.end.day}`;
		key += (key.includes("?") ? "&" : "?") + dSuffix;
	}
	return key;
}

// ── Measurement result filtering ─────────────────────────────

/**
 * Filter an AnalyticsResult for a measurement.
 *
 * - **single** type: aggregates the measureColumn across ALL rows into one value
 *   (grand total). Returns a single-row result with only the measure column.
 * - **series** type: keeps dimensions + time bucket + measureColumn columns,
 *   preserving all rows for trend display.
 * - Returns the original result unchanged if measurement is undefined or has no
 *   measureColumn.
 */
export function filterResultForMeasurement(
	result: AnalyticsResult | null,
	measurement: Measurement | undefined,
	query: { dimensions: Array<{ column: string }>; timeBucket?: { column: string; period: string; outputColumn?: string } } | undefined,
): AnalyticsResult | null {
	if (!result || !measurement || !measurement.measureColumn) return result;

	const measureCol = measurement.measureColumn;
	if (!result.columns.includes(measureCol)) return result;

	if (measurement.type === "single") {
		// Aggregate: sum all numeric values in the measure column into one row
		let total = 0;
		for (const row of result.rows) {
			const v = row[measureCol];
			if (typeof v === "number") total += v;
		}
		return {
			...result,
			columns: [measureCol],
			rows: [{ [measureCol]: total }],
		};
	}

	// Series type: keep dimension columns + time bucket + measure column (all rows)
	const keepSet = new Set<string>();
	for (const d of query?.dimensions ?? []) keepSet.add(d.column);
	if (query?.timeBucket) {
		const tbCol = query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`;
		keepSet.add(tbCol);
	}
	keepSet.add(measureCol);

	const keepCols = result.columns.filter((c) => keepSet.has(c));

	return {
		...result,
		columns: keepCols,
		rows: result.rows.map((row) => {
			const filtered: ResultRow = {};
			for (const col of keepCols) filtered[col] = row[col];
			return filtered;
		}),
	};
}

// ── Date column discovery ────────────────────────────────────

/**
 * Discover date columns from dashboard tile queries.
 * Scans column type hints across all queries referenced by tiles.
 */
export function discoverDateColumns(
	tiles: DashboardTile[],
	queries: SavedAnalyticsQuery[],
): string[] {
	const dateColumns = new Set<string>();
	const queryMap = new Map(queries.map((q) => [q.id, q]));

	for (const tile of tiles) {
		const query = queryMap.get(tile.queryId);
		if (!query) continue;
		for (const hint of query.columnTypeHints) {
			if (hint.type === "date") dateColumns.add(hint.column);
		}
	}

	return [...dateColumns];
}

// ── Cross-tile filter merging ────────────────────────────────

/**
 * Merge a cross-tile filter into the dashboard's dimension filters.
 * Returns a new array with the cross-tile filter value added to the matching column.
 */
export function mergeCrossTileFilter(
	filters: Array<{ column: string; values: string[] }>,
	crossFilter: CrossTileFilter | null,
): Array<{ column: string; values: string[] }> {
	if (!crossFilter) return filters;
	const merged = filters.map((f) => ({ column: f.column, values: [...f.values] }));
	const existing = merged.find((f) => f.column === crossFilter.column);
	if (existing) {
		if (!existing.values.includes(crossFilter.value)) {
			existing.values.push(crossFilter.value);
		}
	} else {
		merged.push({ column: crossFilter.column, values: [crossFilter.value] });
	}
	return merged;
}
