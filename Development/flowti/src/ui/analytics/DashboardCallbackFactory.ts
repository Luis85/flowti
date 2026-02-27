/**
 * Factory for dashboard tile callback handlers.
 *
 * Extracted from DashboardsTab (TD-128, Cycle 49) to:
 * - Eliminate 25 inline anonymous functions from renderDetail()
 * - Enable independent testing of callback wiring and cache invalidation
 * - Enable reuse in AnalyticsDashboardPage (future)
 *
 * Cache invalidation strategy per callback type:
 * - **none**: property-only changes (title, width, height, rules, etc.)
 * - **clearOne**: display mode toggle (stale rendered format), query change
 * - **clearByQueryId**: refresh (re-run same query)
 * - **clear**: measurement change (affects all cached keys)
 */

import type { DashboardTile } from "../../domain/analytics/types";
import type { AnalyticsService } from "../../domain/analytics/AnalyticsService";
import type { TileResultCache } from "./TileResultCache";
import type { AnalyticsHubState, AnalyticsNavigationCallbacks, DashboardFilter } from "./types";
import { mergeCrossTileFilter } from "./dashboardUtils";

export interface DashboardCallbackFactoryDeps {
	analyticsService: AnalyticsService;
	tileResultCache: TileResultCache;
	getState: () => AnalyticsHubState;
	setState: (partial: Partial<AnalyticsHubState>) => void;
	navigation: AnalyticsNavigationCallbacks;
	scheduleRender: () => void;
}

export interface TileCallbacks {
	onRemove: (tileId: string) => void;
	onRefresh: () => void;
	onReorder: (tileId: string, direction: "up" | "down") => void;
	onTitleChange: (tileId: string, newTitle: string) => void;
	onDisplayModeToggle: (tileId: string, newMode: import("../../domain/analytics/types").TileDisplayMode) => void;
	onRulesChange: (tileId: string, rules: import("../../domain/analytics/types").ConditionalRule[]) => void;
	onNumberFormatChange: (tileId: string, format: import("../../domain/analytics/types").NumberDisplayFormat | undefined) => void;
	onChartValueColumnChange: (tileId: string, column: string) => void;
	onChartValueColumnsChange: (tileId: string, columns: string[]) => void;
	onHiddenSeriesChange: (tileId: string, hiddenSeries: string[]) => void;
	onQueryChange: (tileId: string, newQueryId: string) => void;
	onMeasurementChange: (tileId: string, measurementId: string | undefined) => void;
	onWidthChange: (tileId: string, width: number) => void;
	onHeightChange: (tileId: string, height: number) => void;
	onSparklineToggle: (tileId: string, show: boolean) => void;
	onRowLimitChange: (tileId: string, limit: number | undefined) => void;
	onAutoHeightToggle: (tileId: string, auto: boolean) => void;
	onExcludedColumnsChange: (tileId: string, columns: string[]) => void;
	onTableKpisToggle: (tileId: string, show: boolean) => void;
	onTableKpiLabelChange: (tileId: string, label: string) => void;
	onColumnOrderChange: (tileId: string, columns: string[]) => void;
	onViewQuery: (queryId: string) => void;
	onCrossTileFilter: (sourceTileId: string, column: string, value: string) => void;
}

export class DashboardCallbackFactory {
	constructor(private deps: DashboardCallbackFactoryDeps) {}

	/**
	 * Create all tile callbacks for a given dashboard and tile.
	 *
	 * @param dashboardId — the dashboard being edited
	 * @param tile — the tile these callbacks operate on
	 * @param effectiveQueryId — the resolved query ID (measurement-aware)
	 * @param dashboardFilters — current dashboard-level dimension filters
	 * @param onBreadcrumbUpdate — optional callback for cross-tile filter breadcrumb side-effect
	 */
	createTileCallbacks(
		dashboardId: string,
		tile: DashboardTile,
		effectiveQueryId: string,
		dashboardFilters: DashboardFilter[],
		onBreadcrumbUpdate?: (filters: DashboardFilter[], dashboardId: string) => void,
	): TileCallbacks {
		const { analyticsService, tileResultCache, getState, setState, navigation, scheduleRender } = this.deps;

		return {
			onRemove: (tileId) => {
				void analyticsService.removeTile(dashboardId, tileId).then(() => {
					scheduleRender();
				});
			},

			onRefresh: () => {
				tileResultCache.clearByQueryId(effectiveQueryId);
				scheduleRender();
			},

			onReorder: (tileId, direction) => {
				void analyticsService.reorderTile(dashboardId, tileId, direction).then(() => {
					scheduleRender();
				});
			},

			onTitleChange: (tileId, newTitle) => {
				void analyticsService.updateTile(dashboardId, tileId, { title: newTitle }).then(() => {
					scheduleRender();
				});
			},

			onDisplayModeToggle: (tileId, newMode) => {
				void analyticsService.updateTile(dashboardId, tileId, { displayMode: newMode }).then(() => {
					tileResultCache.clearOne(tile.queryId);
					scheduleRender();
				});
			},

			onRulesChange: (tileId, rules) => {
				void analyticsService.updateTile(dashboardId, tileId, { conditionalRules: rules } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onNumberFormatChange: (tileId, format) => {
				void analyticsService.updateTile(dashboardId, tileId, { numberFormat: format } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onChartValueColumnChange: (tileId, column) => {
				void analyticsService.updateTile(dashboardId, tileId, { chartValueColumn: column } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onChartValueColumnsChange: (tileId, columns) => {
				void analyticsService.updateTile(dashboardId, tileId, { chartValueColumns: columns } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onHiddenSeriesChange: (tileId, hiddenSeries) => {
				void analyticsService.updateTile(dashboardId, tileId, { hiddenSeries } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onQueryChange: (tileId, newQueryId) => {
				void analyticsService.updateTile(dashboardId, tileId, { queryId: newQueryId } as Partial<DashboardTile>).then(() => {
					tileResultCache.clearOne(newQueryId);
					scheduleRender();
				});
			},

			onMeasurementChange: (tileId, measurementId) => {
				void analyticsService.updateTile(dashboardId, tileId, { measurementId } as Partial<DashboardTile>).then(() => {
					tileResultCache.clear();
					scheduleRender();
				});
			},

			onWidthChange: (tileId, width) => {
				void analyticsService.updateTile(dashboardId, tileId, { width } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onHeightChange: (tileId, height) => {
				void analyticsService.updateTile(dashboardId, tileId, { height } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onSparklineToggle: (tileId, show) => {
				void analyticsService.updateTile(dashboardId, tileId, { showSparkline: show } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onRowLimitChange: (tileId, limit) => {
				void analyticsService.updateTile(dashboardId, tileId, { rowLimit: limit } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onAutoHeightToggle: (tileId, auto) => {
				void analyticsService.updateTile(dashboardId, tileId, { autoHeight: auto } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onExcludedColumnsChange: (tileId, columns) => {
				void analyticsService.updateTile(dashboardId, tileId, { excludedColumns: columns } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onTableKpisToggle: (tileId, show) => {
				void analyticsService.updateTile(dashboardId, tileId, { showTableKpis: show } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onTableKpiLabelChange: (tileId, label) => {
				void analyticsService.updateTile(dashboardId, tileId, { tableKpiLabel: label || undefined } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onColumnOrderChange: (tileId, columns) => {
				void analyticsService.updateTile(dashboardId, tileId, { columnOrder: columns } as Partial<DashboardTile>).then(() => {
					scheduleRender();
				});
			},

			onViewQuery: (queryId) => {
				setState({ selectedQueryId: queryId });
				navigation.navigateTo("queries");
				scheduleRender();
			},

			onCrossTileFilter: (sourceTileId, column, value) => {
				const current = getState().crossTileFilter;
				// Toggle: same tile+column+value clears the filter
				const isToggleOff = current && current.sourceTileId === sourceTileId && current.column === column && current.value === value;
				const newFilter = isToggleOff ? null : { sourceTileId, column, value };
				setState({ crossTileFilter: newFilter });
				tileResultCache.clear();
				if (onBreadcrumbUpdate) {
					onBreadcrumbUpdate(
						mergeCrossTileFilter(dashboardFilters, newFilter),
						dashboardId,
					);
				}
				scheduleRender();
			},
		};
	}
}
