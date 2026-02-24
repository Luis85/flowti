/**
 * Shared types and constants for QueriesTab sub-components.
 */

import type {
	LocaleId,
	ColumnTypeHint,
	ColumnType,
	ComputedColumn,
	FilterSpec,
	FilterOperator,
	SortSpec,
	JoinSpec,
	DimensionSpec,
	MeasureSpec,
	TimeBucketSpec,
	TimeBucketPeriod,
	AggregationFunction,
	AnalyticsResult,
	AnalyticsSourceType,
	ParsedSourceData,
} from "../../../domain/analytics/types";
import type { AnalyticsHubDeps } from "../types";

// ─────────────────────────────────────────────────────────────
// Query source — runtime state per loaded source
// ─────────────────────────────────────────────────────────────

export interface QuerySource {
	csvPath: string;
	alias: string;
	locale: LocaleId;
	sourceType: AnalyticsSourceType;
	viewIndex?: number;
	data: ParsedSourceData | null;
	loading: boolean;
}

// ─────────────────────────────────────────────────────────────
// Sub-component deps — access to orchestrator state + callbacks
// ─────────────────────────────────────────────────────────────

export interface QueriesSubDeps {
	hubDeps: AnalyticsHubDeps;
	getLoadedHeaders: () => string[];
	renderDetail: () => void;
	renderMaster: () => void;

	// Mutable state accessors
	sources: () => QuerySource[];
	columnTypeHints: () => ColumnTypeHint[];
	setColumnTypeHints: (hints: ColumnTypeHint[]) => void;
	joins: () => JoinSpec[];
	setJoins: (joins: JoinSpec[]) => void;
	dimensions: () => DimensionSpec[];
	setDimensions: (dims: DimensionSpec[]) => void;
	measures: () => MeasureSpec[];
	setMeasures: (measures: MeasureSpec[]) => void;
	timeBucket: () => TimeBucketSpec | null;
	setTimeBucket: (tb: TimeBucketSpec | null) => void;
	filters: () => FilterSpec[];
	setFilters: (filters: FilterSpec[]) => void;
	sort: () => SortSpec | null;
	setSort: (sort: SortSpec | null) => void;
	limit: () => number | null;
	setLimit: (limit: number | null) => void;
	computedColumns: () => ComputedColumn[];
	setComputedColumns: (cols: ComputedColumn[]) => void;
	lastResult: () => AnalyticsResult | null;
	lastDurationMs: () => number | undefined;
	lastError: () => string | null;
	running: () => boolean;
	executeQuery: () => void;
	handleExportCsv: (csv: string) => void;
	applyQuickInsight: (dims: DimensionSpec[], measures: MeasureSpec[], timeBucket: TimeBucketSpec | null) => void;
	loadSavedQuery: (queryId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const LOCALE_OPTIONS: Array<{ id: LocaleId; label: string }> = [
	{ id: "auto", label: "Auto" },
	{ id: "en-US", label: "en-US" },
	{ id: "en-GB", label: "en-GB" },
	{ id: "de-DE", label: "de-DE" },
	{ id: "nl-NL", label: "nl-NL" },
	{ id: "fr-FR", label: "fr-FR" },
];

export const AGG_FUNCTIONS: AggregationFunction[] = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
export const TIME_PERIODS: TimeBucketPeriod[] = ["month", "quarter", "year"];
export const FILTER_OPERATORS: Array<{ id: FilterOperator; label: string }> = [
	{ id: "=", label: "=" },
	{ id: "!=", label: "!=" },
	{ id: ">", label: ">" },
	{ id: "<", label: "<" },
	{ id: ">=", label: ">=" },
	{ id: "<=", label: "<=" },
	{ id: "contains", label: "contains" },
	{ id: "startsWith", label: "starts with" },
];

export const SELECT_CSS = "padding:2px 6px;font-size:var(--font-ui-small);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:var(--radius-s,4px);color:var(--text-normal)";
export const INPUT_CSS = SELECT_CSS + ";width:80px";

// Re-export types used by sub-components
export type {
	LocaleId,
	ColumnTypeHint,
	ColumnType,
	ComputedColumn,
	FilterSpec,
	FilterOperator,
	SortSpec,
	JoinSpec,
	DimensionSpec,
	MeasureSpec,
	TimeBucketSpec,
	TimeBucketPeriod,
	AggregationFunction,
	AnalyticsResult,
};
