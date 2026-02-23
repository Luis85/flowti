/**
 * Types for the Analytics domain.
 *
 * Defines all interfaces for the in-memory CSV analytics engine:
 * locale-aware parsing, joins, grouping, aggregation, and time bucketing.
 */

// ── Locale presets ──────────────────────────────────────

/** Supported locale identifiers for number and date parsing. */
export type LocaleId = "en-US" | "de-DE" | "en-GB" | "nl-NL" | "fr-FR" | "auto";

/** Number format definition for a locale. */
export interface NumberFormat {
	/** Character used as decimal separator (e.g. "." for US, "," for EU) */
	decimalSeparator: string;
	/** Character used as thousands separator (e.g. "," for US, "." for EU, " " for FR) */
	thousandsSeparator: string;
}

/** Date format pattern for a locale. */
export type DateFormatPattern =
	| "MM/DD/YYYY"
	| "DD/MM/YYYY"
	| "DD.MM.YYYY"
	| "YYYY-MM-DD"
	| "auto";

/** Full locale preset combining number and date formats. */
export interface SourceLocale {
	id: LocaleId;
	label: string;
	numberFormat: NumberFormat;
	dateFormat: DateFormatPattern;
}

// ── Column type hints ───────────────────────────────────

/** Data type hint for a column. */
export type ColumnType = "number" | "date" | "string";

/** Per-column type annotation guiding the engine's parsing. */
export interface ColumnTypeHint {
	/** Column header name */
	column: string;
	/** Data type: number triggers locale number parsing, date triggers date parsing */
	type: ColumnType;
}

// ── Join specification ──────────────────────────────────

/** Supported join types. */
export type JoinType = "inner" | "left";

/** Specifies how to join two sources on a key column. */
export interface JoinSpec {
	/** Alias of the left source */
	leftSource: string;
	/** Column name in the left source */
	leftColumn: string;
	/** Alias of the right source */
	rightSource: string;
	/** Column name in the right source */
	rightColumn: string;
	/** Join type: inner excludes non-matches, left keeps all left rows */
	type: JoinType;
}

// ── Dimension and measure specs ─────────────────────────

/** A dimension column used for GROUP BY. */
export interface DimensionSpec {
	/** Column name to group by */
	column: string;
}

/** Supported aggregation functions. */
export type AggregationFunction = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX";

/** A measure to aggregate within each group. */
export interface MeasureSpec {
	/** Column name to aggregate */
	column: string;
	/** Aggregation function to apply */
	function: AggregationFunction;
	/** Optional display label (defaults to "FUNCTION(column)") */
	label?: string;
}

// ── Time bucketing ──────────────────────────────────────

/** Time bucket granularity. */
export type TimeBucketPeriod = "month" | "quarter" | "year";

/** Configuration for time-based bucketing of a date column. */
export interface TimeBucketSpec {
	/** Date column to bucket */
	column: string;
	/** Bucketing granularity */
	period: TimeBucketPeriod;
	/** Optional output column name (defaults to "column_period") */
	outputColumn?: string;
}

// ── Analytics source ────────────────────────────────────

/** A CSV source within an analytics query. */
export interface AnalyticsSource {
	/** Unique alias for referencing in joins (e.g. "items", "sales") */
	alias: string;
	/** Parsed CSV data: headers + rows */
	data: ParsedSourceData;
	/** Locale for parsing numbers and dates in this source */
	locale?: LocaleId;
}

/** Pre-parsed CSV data passed to the engine. */
export interface ParsedSourceData {
	/** Column header names */
	headers: string[];
	/** Row data as string arrays (one per row) */
	rows: string[][];
}

// ── Analytics query ─────────────────────────────────────

/** Complete analytics query configuration. */
export interface AnalyticsQuery {
	/** One or more CSV sources */
	sources: AnalyticsSource[];
	/** Join specifications (empty for single-source queries) */
	joins: JoinSpec[];
	/** Column type hints guiding parse behavior */
	columnTypeHints: ColumnTypeHint[];
	/** Columns to group by */
	dimensions: DimensionSpec[];
	/** Measures to aggregate */
	measures: MeasureSpec[];
	/** Optional time bucketing */
	timeBucket?: TimeBucketSpec;
}

// ── Analytics result ────────────────────────────────────

/** A single row in the analytics result. */
export type ResultRow = Record<string, string | number>;

/** Result of an analytics query execution. */
export interface AnalyticsResult {
	/** Column names in display order */
	columns: string[];
	/** Result rows */
	rows: ResultRow[];
	/** Number of unique dimension-value groups */
	groupCount: number;
	/** Total rows processed (before grouping) */
	sourceRowCount: number;
}

// ── Saved query ─────────────────────────────────────────

/**
 * Serializable query source for persistence (no parsed data — resolved at runtime).
 * Supports CSV files and .base vault views.
 */
export interface SavedAnalyticsQuerySource {
	alias: string;
	/** Path to the source file (.csv or .base) */
	csvPath: string;
	/** Source type: "csv" (default) or "base" */
	sourceType?: AnalyticsSourceType;
	/** For .base sources: which view to use (0-indexed) */
	viewIndex?: number;
	locale?: LocaleId;
}

/** A saved analytics query configuration. */
export interface SavedAnalyticsQuery {
	/** Unique ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Timestamp when saved */
	createdAt: number;
	/** Timestamp of last execution */
	lastRun?: number;
	/** Row count from last execution */
	lastRowCount?: number;
	/** CSV source paths (not parsed data — resolved at runtime) */
	sources: SavedAnalyticsQuerySource[];
	/** Join specifications */
	joins: JoinSpec[];
	/** Column type hints */
	columnTypeHints: ColumnTypeHint[];
	/** Dimensions to group by */
	dimensions: DimensionSpec[];
	/** Measures to aggregate */
	measures: MeasureSpec[];
	/** Optional time bucketing */
	timeBucket?: TimeBucketSpec;
}

// ── Parsed date ─────────────────────────────────────────

/** A parsed date broken into components. */
export interface ParsedDate {
	year: number;
	month: number;
	day: number;
}

// ── Dashboard types ─────────────────────────────────────

/** Display mode for a dashboard tile. */
export type TileDisplayMode = "table" | "stat-card";

/** Source type for analytics queries. */
export type AnalyticsSourceType = "csv" | "base";

/** A single tile within a dashboard. */
export interface DashboardTile {
	/** Unique tile ID */
	id: string;
	/** ID of the saved query this tile renders */
	queryId: string;
	/** Optional display title (defaults to query name) */
	title?: string;
	/** How to render the query results */
	displayMode: TileDisplayMode;
	/** Grid row position */
	row: number;
	/** Grid column position */
	col: number;
	/** Grid column span */
	width: number;
	/** Grid row span */
	height: number;
}

/** A named dashboard containing a grid of tiles. */
export interface Dashboard {
	/** Unique dashboard ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Optional description */
	description?: string;
	/** Tiles in this dashboard */
	tiles: DashboardTile[];
	/** Timestamp when created */
	createdAt: number;
	/** Timestamp of last update */
	updatedAt: number;
}

// ── Analytics state ─────────────────────────────────────

/** Persisted state for the Analytics domain (TypedStorage key: "analytics"). */
export interface AnalyticsState {
	/** Saved query configurations */
	savedAnalyticsQueries: SavedAnalyticsQuery[];
	/** Named dashboards */
	dashboards: Dashboard[];
}
