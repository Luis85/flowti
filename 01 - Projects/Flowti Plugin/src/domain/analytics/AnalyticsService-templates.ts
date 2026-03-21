/**
 * Dashboard template and import methods for AnalyticsService.
 *
 * Extracted from AnalyticsService.ts to stay under max-lines.
 */

import type { AnalyticsService } from "./AnalyticsService";
import type {
	ColumnTypeHint,
	ComputedColumn,
	ConditionalRule,
	Dashboard,
	DimensionSpec,
	FilterSpec,
	JoinSpec,
	MeasureSpec,
	SavedAnalyticsQuerySource,
	SortSpec,
	TileDisplayMode,
	TimeBucketSpec,
} from "./types";

/**
 * Create a new dashboard from a template with source mapping.
 */
export async function createDashboardFromTemplate(
	service: AnalyticsService,
	templateId: string,
	sourceMapping: Record<string, string>,
	dashboardName?: string,
): Promise<Dashboard | undefined> {
	const template = service.listTemplates().find((t) => t.id === templateId);
	if (!template) return undefined;

	const newQueryIds: string[] = [];
	for (const qt of template.queries) {
		const mappedSources: SavedAnalyticsQuerySource[] = qt.originalSources.map((src) => ({
			...src,
			csvPath: sourceMapping[src.csvPath] ?? src.csvPath,
		}));
		const saved = await service.saveQuery(qt.queryConfig.name, mappedSources, {
			joins: qt.queryConfig.joins,
			columnTypeHints: qt.queryConfig.columnTypeHints,
			dimensions: qt.queryConfig.dimensions,
			measures: qt.queryConfig.measures,
			timeBucket: qt.queryConfig.timeBucket,
			filters: qt.queryConfig.filters,
			sort: qt.queryConfig.sort,
			limit: qt.queryConfig.limit,
			computedColumns: qt.queryConfig.computedColumns,
		});
		newQueryIds.push(saved.id);
	}

	const dashboard = await service.createDashboard(dashboardName ?? template.name, template.description);

	for (const tt of template.tiles) {
		const queryId = newQueryIds[tt.queryIndex];
		if (!queryId) continue;
		const tile = await service.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
		if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.chartValueColumns || tt.width !== 2 || tt.height !== 1)) {
			await service.updateTile(dashboard.id, tile.id, {
				width: tt.width, height: tt.height,
				conditionalRules: tt.conditionalRules, chartValueColumn: tt.chartValueColumn, chartValueColumns: tt.chartValueColumns,
			});
		}
	}

	return dashboard;
}

/**
 * Import a dashboard from a raw JSON template (file import).
 */
export async function importDashboardFromJson(
	service: AnalyticsService,
	template: {
		name: string;
		description?: string;
		queries: Array<{
			originalSources: SavedAnalyticsQuerySource[];
			queryConfig: {
				name: string;
				joins: JoinSpec[];
				columnTypeHints: ColumnTypeHint[];
				dimensions: DimensionSpec[];
				measures: MeasureSpec[];
				timeBucket?: TimeBucketSpec;
				filters?: FilterSpec[];
				sort?: SortSpec[];
				limit?: number;
				computedColumns?: ComputedColumn[];
			};
		}>;
		tiles: Array<{
			queryIndex: number;
			title: string;
			displayMode: TileDisplayMode;
			width: number;
			height: number;
			conditionalRules?: ConditionalRule[];
			chartValueColumn?: string;
			chartValueColumns?: string[];
		}>;
	},
	sourceMapping?: Record<string, string>,
): Promise<Dashboard> {
	const mapping = sourceMapping ?? {};

	const newQueryIds: string[] = [];
	for (const qt of template.queries) {
		const mappedSources: SavedAnalyticsQuerySource[] = qt.originalSources.map((src) => ({
			...src,
			csvPath: mapping[src.csvPath] ?? src.csvPath,
		}));
		const saved = await service.saveQuery(qt.queryConfig.name, mappedSources, {
			joins: qt.queryConfig.joins, columnTypeHints: qt.queryConfig.columnTypeHints,
			dimensions: qt.queryConfig.dimensions, measures: qt.queryConfig.measures,
			timeBucket: qt.queryConfig.timeBucket, filters: qt.queryConfig.filters,
			sort: qt.queryConfig.sort, limit: qt.queryConfig.limit,
			computedColumns: qt.queryConfig.computedColumns,
		});
		newQueryIds.push(saved.id);
	}

	const dashboard = await service.createDashboard(template.name, template.description);

	for (const tt of template.tiles) {
		const queryId = newQueryIds[tt.queryIndex];
		if (!queryId) continue;
		const tile = await service.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
		if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.chartValueColumns || tt.width !== 2 || tt.height !== 1)) {
			await service.updateTile(dashboard.id, tile.id, {
				width: tt.width, height: tt.height,
				conditionalRules: tt.conditionalRules, chartValueColumn: tt.chartValueColumn, chartValueColumns: tt.chartValueColumns,
			});
		}
	}

	return dashboard;
}
