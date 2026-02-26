/**
 * Shared types and helpers for tile sub-renderers.
 *
 * Context interfaces moved from DashboardTileRenderer (PBI-ANA-141, Cycle 44).
 */

import type {
	AnalyticsResult,
	ColumnTypeHint,
	ConditionalRule,
	DashboardTile,
	Measurement,
	NumberDisplayFormat,
	SavedAnalyticsQuery,
	TileDisplayMode,
} from "../../../domain/analytics/types";
import { formatDisplayNumber } from "../../../domain/analytics/localeUtils";

// ── Display mode cycle (shared by header dropdown + factory) ─────

export const DISPLAY_MODE_CYCLE: TileDisplayMode[] = [
	"table", "stat-card", "line-chart", "bar-chart", "area-chart", "pie-chart",
];

// ── TileRenderContext (split into 3 focused interfaces, PBI-ANA-124 Cycle 43) ──

/** Data and query result context for tile rendering. */
export interface TileDataContext {
	tile: DashboardTile;
	query: SavedAnalyticsQuery | undefined;
	result: AnalyticsResult | null;
	error: string | null;
	/** Timestamp of last refresh (for freshness display). */
	refreshedAt?: number;
	/** All saved queries — used in settings panel to change the tile's query. */
	queries?: SavedAnalyticsQuery[];
	/** All measurements — used in settings panel for measurement picker. */
	measurements?: Measurement[];
	/** Active dashboard filters — used for visual feedback on matching cells. */
	activeFilters?: Array<{ column: string; values: string[] }>;
}

/** UI interaction callbacks for tile settings and display changes. */
export interface TileUIContext {
	onRemove: (tileId: string) => void;
	onRefresh?: (tileId: string) => void;
	onReorder?: (tileId: string, direction: "up" | "down") => void;
	onTitleChange?: (tileId: string, newTitle: string) => void;
	onDisplayModeToggle?: (tileId: string, newMode: TileDisplayMode) => void;
	onRulesChange?: (tileId: string, rules: ConditionalRule[]) => void;
	/** Whether the tile settings panel is open. */
	settingsOpen?: boolean;
	/** Toggle settings panel open/closed. */
	onToggleSettings?: (tileId: string) => void;
	/** Called when the user selects a different value column for chart display. */
	onChartValueColumnChange?: (tileId: string, column: string) => void;
	/** Called when the user selects multiple value columns for multi-series chart display. */
	onChartValueColumnsChange?: (tileId: string, columns: string[]) => void;
	/** Called when the user toggles series visibility on multi-series chart tiles. */
	onHiddenSeriesChange?: (tileId: string, hiddenSeries: string[]) => void;
	/** Called when the user changes which saved query this tile references. */
	onQueryChange?: (tileId: string, newQueryId: string) => void;
	/** Called when the user changes tile width (1–6 columns). */
	onWidthChange?: (tileId: string, width: number) => void;
	/** Called when the user changes tile height (1–6 rows). */
	onHeightChange?: (tileId: string, height: number) => void;
	/** Called when the user toggles sparkline visibility on stat-card tiles. */
	onSparklineToggle?: (tileId: string, show: boolean) => void;
	/** Called when the user changes the max row limit for this tile. */
	onRowLimitChange?: (tileId: string, limit: number | undefined) => void;
	/** Called when the user toggles auto-height (content-driven height at max width). */
	onAutoHeightToggle?: (tileId: string, auto: boolean) => void;
	/** Called when the user changes number display format for this tile. */
	onNumberFormatChange?: (tileId: string, format: NumberDisplayFormat | undefined) => void;
	/** Called when the user changes which measurement this tile references. */
	onMeasurementChange?: (tileId: string, measurementId: string | undefined) => void;
	/** Called when the user changes which columns to hide in this tile. */
	onExcludedColumnsChange?: (tileId: string, columns: string[]) => void;
	/** Called when the user toggles KPI cards visibility on table tiles. */
	onTableKpisToggle?: (tileId: string, show: boolean) => void;
	/** Called when the user changes the Items KPI label on table tiles. */
	onTableKpiLabelChange?: (tileId: string, label: string) => void;
	/** Called when the user reorders columns on a table tile. */
	onColumnOrderChange?: (tileId: string, columns: string[]) => void;
	/** Current pagination page for table tiles (1-based). Ephemeral — not persisted. */
	currentPage?: number;
	/** Called when the user navigates table pages. */
	onPageChange?: (tileId: string, page: number) => void;
}

/** Navigation callbacks for cross-tab and drill-down actions. */
export interface TileNavContext {
	/** Called when the user clicks "View Query" — navigates to the Queries tab. */
	onViewQuery?: (queryId: string) => void;
	/** Called when the user clicks a string value to drill down (toggles dashboard filter). */
	onDrillDown?: (column: string, value: string) => void;
	/** Called when the user clicks a string value to apply a cross-tile filter (PBI-ANA-132, Cycle 44). */
	onCrossTileFilter?: (sourceTileId: string, column: string, value: string) => void;
}

/** Full tile render context — composed from data, UI, and navigation sub-contexts. */
export type TileRenderContext = TileDataContext & TileUIContext & TileNavContext;

// ── Shared formatting helpers ────────────────────────────────────

/** Resolve the detected currency symbol for a column from type hints. */
export function getDetectedSymbol(hints: ColumnTypeHint[] | undefined, column: string): string | undefined {
	return hints?.find((h) => h.column === column || h.alias === column)?.currencySymbol;
}

/** Resolve the effective NumberDisplayFormat: tile-level wins, measurement displayFormat is fallback. */
export function resolveNumberFormat(ctx: TileRenderContext): NumberDisplayFormat | undefined {
	if (ctx.tile.numberFormat) return ctx.tile.numberFormat;
	if (ctx.tile.measurementId && ctx.measurements) {
		const m = ctx.measurements.find((m) => m.id === ctx.tile.measurementId);
		if (m?.displayFormat) return m.displayFormat;
	}
	return undefined;
}

/** Format a numeric value for tile display, respecting tile numberFormat, measurement displayFormat, and auto-detected currency. */
export function fmtNum(value: number, ctx: TileRenderContext, hints: ColumnTypeHint[] | undefined, column: string): string {
	return formatDisplayNumber(value, resolveNumberFormat(ctx), getDetectedSymbol(hints, column));
}

// ── Sub-renderer interface ───────────────────────────────────────

export interface TileRenderer {
	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void;
}
