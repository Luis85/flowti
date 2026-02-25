/**
 * Analytics domain service — orchestrates query execution and saved query management.
 *
 * Thin facade: loads CSV data, delegates to AnalyticsEngine, emits events,
 * and persists saved query configurations via AnalyticsState.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ParsedCsv } from "../dataExchange/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	AnalyticsQuery,
	AnalyticsResult,
	AnalyticsSource,
	AnalyticsState,
	ColumnTypeHint,
	ComputedColumn,
	ConditionalRule,
	Dashboard,
	DashboardTile,
	DashboardTemplate,
	DashboardTileTemplate,
	DimensionSpec,
	FilterSpec,
	JoinSpec,
	MeasureSpec,
	ParsedSourceData,
	SavedAnalyticsQuery,
	SavedAnalyticsQuerySource,
	SavedQueryTemplate,
	SortSpec,
	TileDisplayMode,
	TimeBucketSpec,
} from "./types";
import { AnalyticsEngine } from "./AnalyticsEngine";
import type { BaseAnalyticsAdapter } from "./BaseAnalyticsAdapter";

/** Callback to read a CSV file's content from the vault. */
export type ReadCsvCallback = (csvPath: string) => Promise<ParsedCsv | null>;

export interface AnalyticsServiceOptions {
	storage: ITypedStorage<AnalyticsState>;
	eventBus?: IEventBus;
	readCsv?: ReadCsvCallback;
	fileSystem?: IFileSystemClient;
}

function generateId(): string {
	return `aq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultState(): AnalyticsState {
	return { savedAnalyticsQueries: [], dashboards: [] };
}

export class AnalyticsService {
	private engine = new AnalyticsEngine();
	private storage: ITypedStorage<AnalyticsState>;
	private state: AnalyticsState = createDefaultState();
	private eventBus?: IEventBus;
	private readCsv?: ReadCsvCallback;
	private baseAdapter?: BaseAnalyticsAdapter;
	private fileSystem?: IFileSystemClient;
	private queryFolder?: string;

	constructor(options: AnalyticsServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.readCsv = options.readCsv;
		this.fileSystem = options.fileSystem;
	}

	/** Load persisted state from storage. */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved && (saved.savedAnalyticsQueries?.length > 0 || saved.dashboards?.length > 0)) {
			this.state = saved;
		}

		await this.eventBus?.emit("analytics.loaded", {
			queryCount: this.state.savedAnalyticsQueries?.length ?? 0,
			dashboardCount: this.state.dashboards?.length ?? 0,
		});
	}

	/** Set the CSV reading callback (wired during setup). */
	setReadCsv(cb: ReadCsvCallback): void {
		this.readCsv = cb;
	}

	/** Set the vault folder where saved queries are written as JSON files. */
	setQueryFolder(folder: string): void {
		this.queryFolder = folder;
	}

	/** Set the base analytics adapter (wired during setup). */
	setBaseAdapter(adapter: BaseAnalyticsAdapter): void {
		this.baseAdapter = adapter;
	}

	/** Read and parse a CSV file from vault. Returns null if reader not configured or file not found. */
	async loadCsv(csvPath: string): Promise<ParsedCsv | null> {
		if (!this.readCsv) return null;
		return this.readCsv(csvPath);
	}

	/** Resolve a .base file view into ParsedSourceData. Returns null if adapter not configured. */
	async loadBase(basePath: string, viewIndex: number): Promise<ParsedSourceData | null> {
		if (!this.baseAdapter) return null;
		return this.baseAdapter.resolve(basePath, viewIndex);
	}

	// ── Query execution ──────────────────────────────────

	/**
	 * Execute an analytics query with pre-loaded source data.
	 * Use this when the caller already has parsed CSV data.
	 */
	async runQuery(query: AnalyticsQuery, queryName?: string): Promise<AnalyticsResult> {
		await this.eventBus?.emit("analytics.query.started", {
			queryName,
			sourceCount: query.sources.length,
			dimensionCount: query.dimensions.length,
			measureCount: query.measures.length,
		});

		const start = Date.now();

		try {
			const result = this.engine.run(query);
			const durationMs = Date.now() - start;

			await this.eventBus?.emit("analytics.query.completed", {
				queryName,
				rowCount: result.rows.length,
				groupCount: result.groupCount,
				durationMs,
				result,
			});

			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.eventBus?.emit("analytics.query.failed", {
				queryName,
				error: message,
			});
			throw err;
		}
	}

	/**
	 * Execute a saved query by ID.
	 * Loads sources from vault (CSV or .base), builds AnalyticsQuery, and runs the engine.
	 */
	async runSavedQuery(queryId: string): Promise<AnalyticsResult> {
		const saved = this.getQuery(queryId);
		if (!saved) throw new Error(`Saved query not found: ${queryId}`);

		// Load sources (CSV or .base)
		const sources: AnalyticsSource[] = [];
		for (const src of saved.sources) {
			const data = await this.resolveSource(src);
			sources.push({
				alias: src.alias,
				data,
				locale: src.locale,
			});
		}

		const query: AnalyticsQuery = {
			sources,
			joins: saved.joins,
			columnTypeHints: saved.columnTypeHints,
			dimensions: saved.dimensions,
			measures: saved.measures,
			timeBucket: saved.timeBucket,
			filters: saved.filters,
			sort: saved.sort,
			limit: saved.limit,
			computedColumns: saved.computedColumns,
		};

		const result = await this.runQuery(query, saved.name);

		// Update last run metadata
		saved.lastRun = Date.now();
		saved.lastRowCount = result.rows.length;
		await this.storage.save(this.state);

		return result;
	}

	/**
	 * Run a saved query with additional dashboard-level filters applied as post-filters.
	 *
	 * Dashboard filters are applied AFTER aggregation/time-bucket transformation
	 * (not at the raw row level) because filter values come from the result data.
	 * Filters for columns not present in the result are silently skipped.
	 */
	async runSavedQueryWithFilters(
		queryId: string,
		extraFilters: Array<{ column: string; values: string[] }>,
	): Promise<AnalyticsResult> {
		// Run the query normally (with its own filters)
		const result = await this.runSavedQuery(queryId);

		// Post-filter the result rows by dashboard filters
		if (extraFilters.length === 0) return result;

		const filteredRows = result.rows.filter((row) =>
			extraFilters.every((f) => {
				const val = row[f.column];
				if (val === undefined) return true; // Column not in result → skip filter
				return f.values.includes(String(val));
			}),
		);

		return {
			...result,
			rows: filteredRows,
			groupCount: filteredRows.length,
		};
	}

	// ── Saved query CRUD ─────────────────────────────────

	/** Save a new analytics query configuration. */
	async saveQuery(
		name: string,
		sources: SavedAnalyticsQuerySource[],
		query: Omit<AnalyticsQuery, "sources">,
	): Promise<SavedAnalyticsQuery> {
		const saved: SavedAnalyticsQuery = {
			id: generateId(),
			name,
			createdAt: Date.now(),
			sources,
			joins: query.joins,
			columnTypeHints: query.columnTypeHints,
			dimensions: query.dimensions,
			measures: query.measures,
			timeBucket: query.timeBucket,
			filters: query.filters,
			sort: query.sort,
			limit: query.limit,
			computedColumns: query.computedColumns,
		};

		const queries = this.state.savedAnalyticsQueries ?? [];
		queries.push(saved);
		this.state.savedAnalyticsQueries = queries;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.saved", {
			queryId: saved.id,
			queryName: saved.name,
		});

		await this.writeQueryFile(saved);

		return saved;
	}

	/** List all saved analytics queries. */
	listQueries(): SavedAnalyticsQuery[] {
		return this.state.savedAnalyticsQueries ?? [];
	}

	/** Get a saved query by ID. */
	getQuery(id: string): SavedAnalyticsQuery | undefined {
		return this.listQueries().find((q) => q.id === id);
	}

	/** Rename a saved query. */
	async renameQuery(id: string, newName: string): Promise<SavedAnalyticsQuery | undefined> {
		const query = this.getQuery(id);
		if (!query) return undefined;
		if (!newName.trim()) return undefined;

		const oldName = query.name;
		query.name = newName.trim();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.renamed", {
			queryId: query.id,
			oldName,
			newName: query.name,
		});

		return query;
	}

	async updateQueryDescription(id: string, description: string | undefined): Promise<void> {
		const query = this.getQuery(id);
		if (!query) return;
		query.description = description;
		await this.storage.save(this.state);
	}

	/** Duplicate a saved query with a new ID and " (copy)" suffix. */
	async duplicateQuery(id: string): Promise<SavedAnalyticsQuery | undefined> {
		const original = this.getQuery(id);
		if (!original) return undefined;

		const clone: SavedAnalyticsQuery = {
			...structuredClone(original),
			id: generateId(),
			name: `${original.name} (copy)`,
			createdAt: Date.now(),
			lastRun: undefined,
			lastRowCount: undefined,
			isFavorite: undefined,
		};

		const queries = this.state.savedAnalyticsQueries ?? [];
		queries.push(clone);
		this.state.savedAnalyticsQueries = queries;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.duplicated", {
			originalQueryId: original.id,
			newQueryId: clone.id,
			newQueryName: clone.name,
		});

		await this.writeQueryFile(clone);

		return clone;
	}

	/** Update an existing saved query's configuration in place. */
	async updateQuery(
		id: string,
		sources: SavedAnalyticsQuerySource[],
		query: Omit<AnalyticsQuery, "sources">,
	): Promise<SavedAnalyticsQuery | undefined> {
		const existing = this.getQuery(id);
		if (!existing) return undefined;

		existing.sources = sources;
		existing.joins = query.joins;
		existing.columnTypeHints = query.columnTypeHints;
		existing.dimensions = query.dimensions;
		existing.measures = query.measures;
		existing.timeBucket = query.timeBucket;
		existing.filters = query.filters;
		existing.sort = query.sort;
		existing.limit = query.limit;
		existing.computedColumns = query.computedColumns;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.saved", {
			queryId: existing.id,
			queryName: existing.name,
		});

		await this.writeQueryFile(existing);

		return existing;
	}

	/** Delete a saved query by ID. */
	async deleteQuery(id: string): Promise<boolean> {
		const queries = this.state.savedAnalyticsQueries ?? [];
		const idx = queries.findIndex((q) => q.id === id);
		if (idx === -1) return false;

		const removed = queries[idx];
		queries.splice(idx, 1);
		this.state.savedAnalyticsQueries = queries;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.deleted", {
			queryId: removed.id,
			queryName: removed.name,
		});

		await this.deleteQueryFile(removed.name);

		return true;
	}

	// ── Dashboard CRUD ───────────────────────────────────

	/** List all dashboards. */
	listDashboards(): Dashboard[] {
		return this.state.dashboards ?? [];
	}

	/** Get a dashboard by ID. */
	getDashboard(id: string): Dashboard | undefined {
		return this.listDashboards().find((d) => d.id === id);
	}

	/** Create a new dashboard. */
	async createDashboard(name: string, description?: string): Promise<Dashboard> {
		const dashboard: Dashboard = {
			id: generateId(),
			name,
			description,
			tiles: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const dashboards = this.state.dashboards ?? [];
		dashboards.push(dashboard);
		this.state.dashboards = dashboards;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.created", { dashboard });

		return dashboard;
	}

	/** Update a dashboard's name and/or description. */
	async updateDashboard(id: string, changes: { name?: string; description?: string }): Promise<Dashboard | undefined> {
		const dashboard = this.getDashboard(id);
		if (!dashboard) return undefined;

		if (changes.name !== undefined) dashboard.name = changes.name;
		if (changes.description !== undefined) dashboard.description = changes.description;
		dashboard.updatedAt = Date.now();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.updated", { dashboard });

		return dashboard;
	}

	/** Delete a dashboard by ID. */
	async deleteDashboard(id: string): Promise<boolean> {
		const dashboards = this.state.dashboards ?? [];
		const idx = dashboards.findIndex((d) => d.id === id);
		if (idx === -1) return false;

		const removed = dashboards[idx];
		dashboards.splice(idx, 1);
		this.state.dashboards = dashboards;

		// Clear default if the deleted dashboard was the default
		if (this.state.defaultDashboardId === id) {
			this.state.defaultDashboardId = null;
		}

		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.deleted", {
			dashboardId: removed.id,
			dashboardName: removed.name,
		});

		return true;
	}

	// ── Favorites & Default ─────────────────────────────

	/** Toggle a saved query's favorite status. */
	async toggleQueryFavorite(id: string): Promise<boolean | undefined> {
		const query = this.getQuery(id);
		if (!query) return undefined;

		query.isFavorite = !query.isFavorite;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.favorited", {
			queryId: query.id,
			queryName: query.name,
			isFavorite: query.isFavorite,
		});

		return query.isFavorite;
	}

	/** Toggle a dashboard's favorite status. */
	async toggleDashboardFavorite(id: string): Promise<boolean | undefined> {
		const dashboard = this.getDashboard(id);
		if (!dashboard) return undefined;

		dashboard.isFavorite = !dashboard.isFavorite;
		dashboard.updatedAt = Date.now();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.favorited", {
			dashboardId: dashboard.id,
			dashboardName: dashboard.name,
			isFavorite: dashboard.isFavorite,
		});

		return dashboard.isFavorite;
	}

	/** Set the default dashboard (shown on hub overview). Pass null to clear. */
	async setDefaultDashboard(id: string | null): Promise<void> {
		if (id !== null && !this.getDashboard(id)) return;

		this.state.defaultDashboardId = id;
		await this.storage.save(this.state);

		const dashboard = id ? this.getDashboard(id) : undefined;
		await this.eventBus?.emit("analytics.dashboard.defaultChanged", {
			dashboardId: id,
			dashboardName: dashboard?.name,
		});
	}

	/** Get the default dashboard, or undefined if not set or not found. */
	getDefaultDashboard(): Dashboard | undefined {
		const id = this.state.defaultDashboardId;
		if (!id) return undefined;
		return this.getDashboard(id);
	}

	/** Add a tile to a dashboard. */
	async addTile(dashboardId: string, queryId: string, displayMode: TileDisplayMode, title?: string): Promise<DashboardTile | undefined> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return undefined;

		const row = dashboard.tiles.length > 0
			? Math.max(...dashboard.tiles.map((t) => t.row + t.height))
			: 0;

		const tile: DashboardTile = {
			id: generateId(),
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
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.tile.added", { dashboardId, tile });

		return tile;
	}

	/** Remove a tile from a dashboard. */
	async removeTile(dashboardId: string, tileId: string): Promise<boolean> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return false;

		const idx = dashboard.tiles.findIndex((t) => t.id === tileId);
		if (idx === -1) return false;

		dashboard.tiles.splice(idx, 1);
		dashboard.updatedAt = Date.now();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.tile.removed", { dashboardId, tileId });

		return true;
	}

	/** Mutable keys on DashboardTile (everything except "id"). Add new tile fields here. */
	private static readonly TILE_MUTABLE_KEYS: ReadonlyArray<keyof Omit<DashboardTile, "id">> = [
		"queryId", "title", "displayMode", "row", "col", "width", "height",
		"conditionalRules", "showSparkline", "chartValueColumn", "rowLimit", "autoHeight",
	];

	/** Update a tile's properties within a dashboard. */
	async updateTile(dashboardId: string, tileId: string, changes: Partial<Omit<DashboardTile, "id">>): Promise<DashboardTile | undefined> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return undefined;

		const tile = dashboard.tiles.find((t) => t.id === tileId);
		if (!tile) return undefined;

		for (const key of AnalyticsService.TILE_MUTABLE_KEYS) {
			if (changes[key] !== undefined) {
				(tile as unknown as Record<string, unknown>)[key] = changes[key];
			}
		}

		dashboard.updatedAt = Date.now();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.tile.updated", { dashboardId, tile });

		return tile;
	}

	/** Reorder a tile within a dashboard (move up or down). */
	async reorderTile(dashboardId: string, tileId: string, direction: "up" | "down"): Promise<boolean> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return false;

		const idx = dashboard.tiles.findIndex((t) => t.id === tileId);
		if (idx === -1) return false;

		const newIdx = direction === "up" ? idx - 1 : idx + 1;
		if (newIdx < 0 || newIdx >= dashboard.tiles.length) return false;

		// Swap tiles
		[dashboard.tiles[idx], dashboard.tiles[newIdx]] = [dashboard.tiles[newIdx], dashboard.tiles[idx]];
		dashboard.updatedAt = Date.now();
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.dashboard.tile.reordered", { dashboardId, tileId, direction });

		return true;
	}

	// ── Dashboard templates ─────────────────────────────

	/** List all saved dashboard templates. */
	listTemplates(): DashboardTemplate[] {
		return this.state.templates ?? [];
	}

	/** Save a dashboard as a reusable template. */
	async saveDashboardAsTemplate(
		dashboardId: string,
		name: string,
		description: string,
		domain: string,
	): Promise<DashboardTemplate | undefined> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return undefined;

		// Build unique source list from all tiles' queries
		const queryTemplates: SavedQueryTemplate[] = [];
		const queryIdToIndex = new Map<string, number>();

		for (const tile of dashboard.tiles) {
			if (queryIdToIndex.has(tile.queryId)) continue;

			const query = this.getQuery(tile.queryId);
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

		const template: DashboardTemplate = {
			id: generateId(),
			name,
			description,
			domain,
			queries: queryTemplates,
			tiles: tileTemplates,
			createdAt: Date.now(),
		};

		const templates = this.state.templates ?? [];
		templates.push(template);
		this.state.templates = templates;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.template.saved", {
			templateId: template.id,
			templateName: template.name,
			domain: template.domain,
		});

		return template;
	}

	/**
	 * Create a new dashboard from a template with source mapping.
	 * @param templateId - ID of the template to instantiate
	 * @param sourceMapping - Map from original source path to new source path
	 * @param dashboardName - Optional name override (defaults to template name)
	 */
	async createDashboardFromTemplate(
		templateId: string,
		sourceMapping: Record<string, string>,
		dashboardName?: string,
	): Promise<Dashboard | undefined> {
		const template = this.listTemplates().find((t) => t.id === templateId);
		if (!template) return undefined;

		// Create saved queries from template with mapped sources
		const newQueryIds: string[] = [];
		for (const qt of template.queries) {
			const mappedSources: SavedAnalyticsQuerySource[] = qt.originalSources.map((src) => ({
				...src,
				csvPath: sourceMapping[src.csvPath] ?? src.csvPath,
			}));

			const saved = await this.saveQuery(
				qt.queryConfig.name,
				mappedSources,
				{
					joins: qt.queryConfig.joins,
					columnTypeHints: qt.queryConfig.columnTypeHints,
					dimensions: qt.queryConfig.dimensions,
					measures: qt.queryConfig.measures,
					timeBucket: qt.queryConfig.timeBucket,
					filters: qt.queryConfig.filters,
					sort: qt.queryConfig.sort,
					limit: qt.queryConfig.limit,
					computedColumns: qt.queryConfig.computedColumns,
				},
			);
			newQueryIds.push(saved.id);
		}

		// Create dashboard
		const dashboard = await this.createDashboard(
			dashboardName ?? template.name,
			template.description,
		);

		// Add tiles referencing the new queries
		for (const tt of template.tiles) {
			const queryId = newQueryIds[tt.queryIndex];
			if (!queryId) continue;

			const tile = await this.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
			if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.width !== 2 || tt.height !== 1)) {
				await this.updateTile(dashboard.id, tile.id, {
					width: tt.width,
					height: tt.height,
					conditionalRules: tt.conditionalRules,
					chartValueColumn: tt.chartValueColumn,
				});
			}
		}

		await this.eventBus?.emit("analytics.template.used", {
			templateId: template.id,
			dashboardId: dashboard.id,
			dashboardName: dashboard.name,
		});

		return dashboard;
	}

	/** Delete a template by ID. */
	async deleteTemplate(templateId: string): Promise<boolean> {
		const templates = this.state.templates ?? [];
		const idx = templates.findIndex((t) => t.id === templateId);
		if (idx === -1) return false;

		templates.splice(idx, 1);
		this.state.templates = templates;
		await this.storage.save(this.state);
		return true;
	}

	/** Import a dashboard from a raw JSON template (file import). */
	async importDashboardFromJson(
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
					sort?: SortSpec;
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

			const saved = await this.saveQuery(qt.queryConfig.name, mappedSources, {
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

		const dashboard = await this.createDashboard(template.name, template.description);

		for (const tt of template.tiles) {
			const queryId = newQueryIds[tt.queryIndex];
			if (!queryId) continue;

			const tile = await this.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
			if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.width !== 2 || tt.height !== 1)) {
				await this.updateTile(dashboard.id, tile.id, {
					width: tt.width,
					height: tt.height,
					conditionalRules: tt.conditionalRules,
					chartValueColumn: tt.chartValueColumn,
				});
			}
		}

		return dashboard;
	}

	// ── Source resolution ────────────────────────────────

	/** Resolve a saved query source to ParsedSourceData, regardless of type. */
	private async resolveSource(src: SavedAnalyticsQuerySource): Promise<ParsedSourceData> {
		if (src.sourceType === "base") {
			if (!this.baseAdapter) throw new Error("Base adapter not configured");
			return this.baseAdapter.resolve(src.csvPath, src.viewIndex ?? 0);
		}

		// Default: CSV
		if (!this.readCsv) throw new Error("CSV reader not configured");
		const parsed = await this.readCsv(src.csvPath);
		if (!parsed) throw new Error(`CSV not found: ${src.csvPath}`);
		return { headers: parsed.headers, rows: parsed.rows };
	}

	// ── File persistence ────────────────────────────────

	/** Write a saved query as a JSON file in the query folder. */
	private async writeQueryFile(query: SavedAnalyticsQuery): Promise<void> {
		if (!this.fileSystem || !this.queryFolder) return;
		const path = `${this.queryFolder}/${this.sanitizeFileName(query.name)}.json`;
		const content = JSON.stringify(query, null, 2);
		try {
			await this.fileSystem.createFile(path, content, { createFolders: true });
		} catch {
			// File already exists — overwrite with updated content
			try { await this.fileSystem.updateFile(path, content); } catch { /* best-effort */ }
		}
	}

	/** Delete the JSON file for a query by name. */
	private async deleteQueryFile(queryName: string): Promise<void> {
		if (!this.fileSystem || !this.queryFolder) return;
		const path = `${this.queryFolder}/${this.sanitizeFileName(queryName)}.json`;
		try { await this.fileSystem.deleteFile(path); } catch { /* file may not exist */ }
	}

	/** Sanitize a query name for use as a filename. */
	private sanitizeFileName(name: string): string {
		return name.replace(/[\\/:*?"<>|]/g, "-").trim();
	}
}
