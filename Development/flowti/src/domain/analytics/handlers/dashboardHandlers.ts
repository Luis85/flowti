/**
 * Dashboard CRUD handler module for the Analytics domain.
 *
 * Extracted from AnalyticsService (TD-ANA-002) following the
 * SessionService handler pattern. Handles dashboard, tile,
 * favorites, defaults, and template operations.
 */

import type { AnalyticsHandlerContext } from "./types";
import type {
	Dashboard,
	DashboardTemplate,
	DashboardTile,
	DashboardTileTemplate,
	SavedQueryTemplate,
	TileDisplayMode,
} from "../types";

// ── Dashboard CRUD ──────────────────────────────────────

export function listDashboards(ctx: AnalyticsHandlerContext): Dashboard[] {
	return ctx.getState().dashboards ?? [];
}

export function getDashboard(ctx: AnalyticsHandlerContext, id: string): Dashboard | undefined {
	return listDashboards(ctx).find((d) => d.id === id);
}

export async function createDashboard(
	ctx: AnalyticsHandlerContext,
	name: string,
	description?: string,
): Promise<Dashboard> {
	const dashboard: Dashboard = {
		id: ctx.generateId(),
		name,
		description,
		tiles: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	const dashboards = ctx.getState().dashboards ?? [];
	dashboards.push(dashboard);
	ctx.getState().dashboards = dashboards;
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.created", { dashboard });
	return dashboard;
}

export async function updateDashboard(
	ctx: AnalyticsHandlerContext,
	id: string,
	changes: { name?: string; description?: string },
): Promise<Dashboard | undefined> {
	const dashboard = getDashboard(ctx, id);
	if (!dashboard) return undefined;

	if (changes.name !== undefined) dashboard.name = changes.name;
	if (changes.description !== undefined) dashboard.description = changes.description;
	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.updated", { dashboard });
	return dashboard;
}

export async function deleteDashboard(ctx: AnalyticsHandlerContext, id: string): Promise<boolean> {
	const dashboards = ctx.getState().dashboards ?? [];
	const idx = dashboards.findIndex((d) => d.id === id);
	if (idx === -1) return false;

	const removed = dashboards[idx];
	dashboards.splice(idx, 1);
	ctx.getState().dashboards = dashboards;

	if (ctx.getState().defaultDashboardId === id) {
		ctx.getState().defaultDashboardId = null;
	}

	await ctx.save();
	await ctx.eventBus?.emit("analytics.dashboard.deleted", {
		dashboardId: removed.id,
		dashboardName: removed.name,
	});
	return true;
}

// ── Favorites & Default ─────────────────────────────────

export async function toggleDashboardFavorite(
	ctx: AnalyticsHandlerContext,
	id: string,
): Promise<boolean | undefined> {
	const dashboard = getDashboard(ctx, id);
	if (!dashboard) return undefined;

	dashboard.isFavorite = !dashboard.isFavorite;
	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.favorited", {
		dashboardId: dashboard.id,
		dashboardName: dashboard.name,
		isFavorite: dashboard.isFavorite,
	});
	return dashboard.isFavorite;
}

export async function setDefaultDashboard(
	ctx: AnalyticsHandlerContext,
	id: string | null,
): Promise<void> {
	if (id !== null && !getDashboard(ctx, id)) return;

	ctx.getState().defaultDashboardId = id;
	await ctx.save();

	const dashboard = id ? getDashboard(ctx, id) : undefined;
	await ctx.eventBus?.emit("analytics.dashboard.defaultChanged", {
		dashboardId: id,
		dashboardName: dashboard?.name,
	});
}

export function getDefaultDashboard(ctx: AnalyticsHandlerContext): Dashboard | undefined {
	const id = ctx.getState().defaultDashboardId;
	if (!id) return undefined;
	return getDashboard(ctx, id);
}

// ── Tile CRUD ───────────────────────────────────────────

export async function addTile(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	queryId: string,
	displayMode: TileDisplayMode,
	title?: string,
): Promise<DashboardTile | undefined> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return undefined;

	const row = dashboard.tiles.length > 0
		? Math.max(...dashboard.tiles.map((t) => t.row + t.height))
		: 0;

	const tile: DashboardTile = {
		id: ctx.generateId(),
		queryId,
		title,
		displayMode,
		row,
		col: 0,
		width: 2,
		height: 1,
	};

	dashboard.tiles.push(tile);
	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.tile.added", { dashboardId, tile });
	return tile;
}

export async function removeTile(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	tileId: string,
): Promise<boolean> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return false;

	const idx = dashboard.tiles.findIndex((t) => t.id === tileId);
	if (idx === -1) return false;

	dashboard.tiles.splice(idx, 1);
	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.tile.removed", { dashboardId, tileId });
	return true;
}

/** Mutable keys on DashboardTile (everything except "id"). */
const TILE_MUTABLE_KEYS: ReadonlyArray<keyof Omit<DashboardTile, "id">> = [
	"queryId", "title", "displayMode", "row", "col", "width", "height",
	"conditionalRules", "showSparkline", "chartValueColumn", "rowLimit", "autoHeight", "numberFormat", "measurementId", "excludedColumns", "showTableKpis", "columnOrder",
];

export async function updateTile(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	tileId: string,
	changes: Partial<Omit<DashboardTile, "id">>,
): Promise<DashboardTile | undefined> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return undefined;

	const tile = dashboard.tiles.find((t) => t.id === tileId);
	if (!tile) return undefined;

	for (const key of TILE_MUTABLE_KEYS) {
		if (key in changes) {
			(tile as unknown as Record<string, unknown>)[key] = changes[key];
		}
	}

	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.tile.updated", { dashboardId, tile });
	return tile;
}

export async function reorderTile(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	tileId: string,
	direction: "up" | "down",
): Promise<boolean> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return false;

	const idx = dashboard.tiles.findIndex((t) => t.id === tileId);
	if (idx === -1) return false;

	const newIdx = direction === "up" ? idx - 1 : idx + 1;
	if (newIdx < 0 || newIdx >= dashboard.tiles.length) return false;

	[dashboard.tiles[idx], dashboard.tiles[newIdx]] = [dashboard.tiles[newIdx], dashboard.tiles[idx]];
	dashboard.updatedAt = Date.now();
	await ctx.save();

	await ctx.eventBus?.emit("analytics.dashboard.tile.reordered", { dashboardId, tileId, direction });
	return true;
}

// ── Dashboard templates ─────────────────────────────────

export function listTemplates(ctx: AnalyticsHandlerContext): DashboardTemplate[] {
	return ctx.getState().templates ?? [];
}

/** Build a template object from a dashboard without persisting. */
export function buildDashboardTemplate(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	name: string,
	description: string,
	domain: string,
): DashboardTemplate | undefined {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return undefined;

	const queryTemplates: SavedQueryTemplate[] = [];
	const queryIdToIndex = new Map<string, number>();

	for (const tile of dashboard.tiles) {
		if (queryIdToIndex.has(tile.queryId)) continue;

		const query = ctx.getQuery(tile.queryId);
		if (!query) continue;

		const index = queryTemplates.length;
		queryIdToIndex.set(tile.queryId, index);

		queryTemplates.push({
			originalSources: structuredClone(query.sources),
			queryConfig: {
				name: query.name,
				joins: query.joins,
				columnTypeHints: query.columnTypeHints,
				dimensions: query.dimensions,
				measures: query.measures,
				timeBucket: query.timeBucket,
				filters: query.filters,
				sort: query.sort,
				limit: query.limit,
				computedColumns: query.computedColumns,
			},
		});
	}

	const tileTemplates: DashboardTileTemplate[] = dashboard.tiles
		.filter((t) => queryIdToIndex.has(t.queryId))
		.map((t) => ({
			queryIndex: queryIdToIndex.get(t.queryId)!,
			title: t.title ?? "",
			displayMode: t.displayMode,
			width: t.width,
			height: t.height,
			conditionalRules: t.conditionalRules,
			chartValueColumn: t.chartValueColumn,
		}));

	return {
		id: ctx.generateId(),
		name,
		description,
		domain,
		queries: queryTemplates,
		tiles: tileTemplates,
		createdAt: Date.now(),
	};
}

export async function saveDashboardAsTemplate(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	name: string,
	description: string,
	domain: string,
): Promise<DashboardTemplate | undefined> {
	const template = buildDashboardTemplate(ctx, dashboardId, name, description, domain);
	if (!template) return undefined;

	const templates = ctx.getState().templates ?? [];
	templates.push(template);
	ctx.getState().templates = templates;
	await ctx.save();

	await ctx.eventBus?.emit("analytics.template.saved", {
		templateId: template.id,
		templateName: template.name,
		domain: template.domain,
	});

	return template;
}

export async function deleteTemplate(
	ctx: AnalyticsHandlerContext,
	templateId: string,
): Promise<boolean> {
	const templates = ctx.getState().templates ?? [];
	const idx = templates.findIndex((t) => t.id === templateId);
	if (idx === -1) return false;

	templates.splice(idx, 1);
	ctx.getState().templates = templates;
	await ctx.save();
	return true;
}

// ── Orphan protection ────────────────────────────────────

/** Clear measurementId from all tiles that reference a given measurement. */
export async function clearMeasurementFromTiles(
	ctx: AnalyticsHandlerContext,
	measurementId: string,
): Promise<number> {
	let cleared = 0;
	for (const dashboard of listDashboards(ctx)) {
		for (const tile of dashboard.tiles) {
			if (tile.measurementId === measurementId) {
				tile.measurementId = undefined;
				cleared++;
			}
		}
	}
	if (cleared > 0) await ctx.save();
	return cleared;
}

// ── Filter presets ───────────────────────────────────────

export async function saveFilterPreset(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	name: string,
	filters: Array<{ column: string; values: string[] }>,
): Promise<{ id: string; name: string } | undefined> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard) return undefined;

	if (!dashboard.savedFilterPresets) dashboard.savedFilterPresets = [];
	const preset = {
		id: ctx.generateId().replace(/^aq_/, "fp_"),
		name,
		filters: structuredClone(filters),
	};
	dashboard.savedFilterPresets.push(preset);
	dashboard.updatedAt = Date.now();
	await ctx.save();
	return { id: preset.id, name: preset.name };
}

export async function deleteFilterPreset(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
	presetId: string,
): Promise<boolean> {
	const dashboard = getDashboard(ctx, dashboardId);
	if (!dashboard?.savedFilterPresets) return false;

	const idx = dashboard.savedFilterPresets.findIndex((p) => p.id === presetId);
	if (idx < 0) return false;

	dashboard.savedFilterPresets.splice(idx, 1);
	dashboard.updatedAt = Date.now();
	await ctx.save();
	return true;
}

// ── Dashboard query map ─────────────────────────────────

export function getDashboardQueryMap(
	ctx: AnalyticsHandlerContext,
	dashboardId: string,
): Map<string, { query: ReturnType<AnalyticsHandlerContext["getQuery"]> extends infer T ? NonNullable<T> : never; tileCount: number }> {
	const dashboard = getDashboard(ctx, dashboardId);
	const result = new Map<string, { query: NonNullable<ReturnType<AnalyticsHandlerContext["getQuery"]>>; tileCount: number }>();
	if (!dashboard) return result;
	for (const tile of dashboard.tiles) {
		const existing = result.get(tile.queryId);
		if (existing) {
			existing.tileCount++;
		} else {
			const query = ctx.getQuery(tile.queryId);
			if (query) result.set(tile.queryId, { query, tileCount: 1 });
		}
	}
	return result;
}
