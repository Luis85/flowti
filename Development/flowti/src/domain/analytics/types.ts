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
	/** Detected currency symbol (e.g. "$", "€") — set when source values contain currency prefixes */
	currencySymbol?: string;
}

/** Display format styles for numeric values. */
export type NumberFormatStyle = "plain" | "currency" | "percent";

/** Number display format configuration for dashboard tiles. */
export interface NumberDisplayFormat {
	/** Format style: plain (default), currency (with symbol), or percent */
	style: NumberFormatStyle;
	/** Currency symbol (e.g. "$", "€") — overrides auto-detected symbol */
	symbol?: string;
	/** Fixed decimal places (undefined = auto) */
	decimals?: number;
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
export type AggregationFunction = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT";

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

// ── Filter and sort specs ───────────────────────────────

/** Supported filter operators. */
export type FilterOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "startsWith";

/** A filter condition applied to rows before grouping. */
export interface FilterSpec {
	/** Column to filter on */
	column: string;
	/** Comparison operator */
	operator: FilterOperator;
	/** Value to compare against */
	value: string;
}

/** Sort specification for result rows. */
export interface SortSpec {
	/** Column to sort by */
	column: string;
	/** Sort direction */
	direction: "asc" | "desc";
}

// ── Computed columns ────────────────────────────────────

/** A computed column evaluated from an arithmetic expression on result columns. */
export interface ComputedColumn {
	/** Display name for the computed column */
	name: string;
	/**
	 * Expression using {Column Label} references, arithmetic (+, -, *, /),
	 * scalar functions (ROUND, ABS, IF), and window functions (CHANGE, PCT_CHANGE, ROLLING_AVG).
	 */
	expression: string;
}

/** Recognized function names in computed column expressions. */
export type WindowFunctionName = "CHANGE" | "PCT_CHANGE" | "ROLLING_AVG";
export type ScalarFunctionName = "ROUND" | "ABS" | "IF";
export type FunctionName = WindowFunctionName | ScalarFunctionName;

/** A parsed function call token extracted from an expression. */
export interface FunctionToken {
	/** Function name (uppercase) */
	name: FunctionName;
	/** Raw argument strings (may contain nested functions or column refs) */
	args: string[];
	/** Original text span in the expression (for substitution) */
	raw: string;
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
	/** Optional row filters (applied before grouping) */
	filters?: FilterSpec[];
	/** Optional result sorting — array of sort specs applied left-to-right (applied after aggregation) */
	sort?: SortSpec[];
	/** Optional row limit (applied after sorting) */
	limit?: number;
	/** Optional computed columns (evaluated after aggregation) */
	computedColumns?: ComputedColumn[];
	/** Optional list of column names to exclude from the result output */
	excludedColumns?: string[];
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
	/** Column type hints from source data (includes detected currency symbols) */
	columnTypeHints?: ColumnTypeHint[];
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
	/** Optional description — "What question does this query answer?" */
	description?: string;
	/** Whether this query is marked as a favorite */
	isFavorite?: boolean;
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
	/** Optional row filters (applied before grouping) */
	filters?: FilterSpec[];
	/** Optional result sorting — array of sort specs applied left-to-right (applied after aggregation) */
	sort?: SortSpec[];
	/** Optional row limit (applied after sorting) */
	limit?: number;
	/** Optional computed columns (evaluated after aggregation) */
	computedColumns?: ComputedColumn[];
	/** Optional list of column names to exclude from the result output */
	excludedColumns?: string[];
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
export type TileDisplayMode = "table" | "stat-card" | "line-chart" | "bar-chart" | "area-chart" | "pie-chart";

/** Source type for analytics queries. */
export type AnalyticsSourceType = "csv" | "base" | "csv-folder";

/** Comparison operator for conditional formatting rules. */
export type ConditionalOperator = ">" | "<" | ">=" | "<=" | "=" | "!=";

/** Built-in color preset names for conditional formatting. */
export type ColorPreset = "positive" | "negative" | "warning";

/** A conditional formatting rule applied to tile cells. */
export interface ConditionalRule {
	/** Column to evaluate */
	column: string;
	/** Comparison operator */
	operator: ConditionalOperator;
	/** Threshold value to compare against */
	threshold: number;
	/** Color preset name or CSS color string */
	color: ColorPreset | string;
}

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
	/** Optional conditional formatting rules (first match wins) */
	conditionalRules?: ConditionalRule[];
	/** Show sparkline mini-charts in stat-card tiles (default: true) */
	showSparkline?: boolean;
	/** Selected value column for chart display (defaults to first numeric column) */
	chartValueColumn?: string;
	/** Max number of rows to render (undefined = all rows) */
	rowLimit?: number;
	/** When true at max-width (3 cols), height is driven by content instead of grid rows */
	autoHeight?: boolean;
	/** Number display format for numeric values in this tile */
	numberFormat?: NumberDisplayFormat;
	/** Optional measurement ID — tile uses measurement's query instead of direct queryId */
	measurementId?: string;
}

/** A named dashboard containing a grid of tiles. */
export interface Dashboard {
	/** Unique dashboard ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Optional description */
	description?: string;
	/** Whether this dashboard is marked as a favorite */
	isFavorite?: boolean;
	/** Tiles in this dashboard */
	tiles: DashboardTile[];
	/** Timestamp when created */
	createdAt: number;
	/** Timestamp of last update */
	updatedAt: number;
}

// ── Dashboard template types ────────────────────────────

/** Template for a saved query — captures config with source paths as placeholders. */
export interface SavedQueryTemplate {
	/** Original sources (paths used as placeholders for source mapping) */
	originalSources: SavedAnalyticsQuerySource[];
	/** Query configuration (without runtime fields) */
	queryConfig: Omit<SavedAnalyticsQuery, "id" | "createdAt" | "lastRun" | "lastRowCount" | "sources" | "isFavorite">;
}

/** Template for a dashboard tile — references a query by index. */
export interface DashboardTileTemplate {
	/** Index into the template's queries array */
	queryIndex: number;
	/** Tile display title */
	title: string;
	/** Display mode */
	displayMode: TileDisplayMode;
	/** Grid width */
	width: number;
	/** Grid height */
	height: number;
	/** Optional conditional formatting rules */
	conditionalRules?: ConditionalRule[];
	/** Optional chart value column */
	chartValueColumn?: string;
}

/** A reusable dashboard template — captures queries + tile layout. */
export interface DashboardTemplate {
	/** Unique template ID */
	id: string;
	/** Template name */
	name: string;
	/** Description of what this template provides */
	description: string;
	/** Domain tag (e.g., "Supplier Management", "Inventory Management") */
	domain: string;
	/** Query templates (each with source placeholder) */
	queries: SavedQueryTemplate[];
	/** Tile layout templates */
	tiles: DashboardTileTemplate[];
	/** Timestamp when created */
	createdAt: number;
}

// ── Measurement types ────────────────────────────────────

/** Whether a measurement returns a single value or a full series. */
export type MeasurementType = "single" | "series";

/** A measurement — a reusable, named metric derived from a saved query. */
export interface Measurement {
	/** Unique ID (pattern: "am_<timestamp36>_<random6>") */
	id: string;
	/** User-provided name (e.g., "Total Revenue") */
	name: string;
	/** Optional description */
	description?: string;
	/** Source query ID */
	queryId: string;
	/** Single metric vs time-series */
	type: MeasurementType;
	/** Specific column to extract (undefined = full query result) */
	measureColumn?: string;
	/** Display format for the value */
	displayFormat?: NumberDisplayFormat;
	/** Whether marked as a favorite */
	isFavorite?: boolean;
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
	/** ID of the default dashboard shown on hub overview (null = no default) */
	defaultDashboardId?: string | null;
	/** Saved dashboard templates */
	templates?: DashboardTemplate[];
	/** Saved measurements */
	measurements?: Measurement[];
}
