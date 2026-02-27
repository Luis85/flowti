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
	DimensionSpec,
	Measurement,
	MeasurementType,
	NumberDisplayFormat,
	OnboardingChecklist,
	FilterSpec,
	JoinSpec,
	MeasureSpec,
	ParsedSourceData,
	SavedAnalyticsQuery,
	QueryDateRangeFilter,
	SavedAnalyticsQuerySource,
	SortSpec,
	TileDisplayMode,
	TimeBucketSpec,
} from "./types";
import { AnalyticsEngine } from "./AnalyticsEngine";
import { QueryResultCache } from "./QueryResultCache";
import type { BaseAnalyticsAdapter } from "./BaseAnalyticsAdapter";
import type { AnalyticsHandlerContext } from "./handlers/types";
import { dashboardHandlers, measurementHandlers } from "./handlers";

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
	private queryCache = new QueryResultCache();
	private storage: ITypedStorage<AnalyticsState>;
	private state: AnalyticsState = createDefaultState();
	private eventBus?: IEventBus;
	private readCsv?: ReadCsvCallback;
	private baseAdapter?: BaseAnalyticsAdapter;
	private fileSystem?: IFileSystemClient;
	private queryFolder?: string;
	private listFolder?: (folderPath: string) => Promise<string[]>;

	constructor(options: AnalyticsServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.readCsv = options.readCsv;
		this.fileSystem = options.fileSystem;
	}

	/** Build handler context for delegating to handler modules. */
	private ctx(): AnalyticsHandlerContext {
		return {
			getState: () => this.state,
			save: () => this.storage.save(this.state),
			eventBus: this.eventBus,
			generateId,
			getQuery: (id) => this.getQuery(id),
			getDashboard: (id) => dashboardHandlers.getDashboard(this.ctx(), id),
		};
	}

	/** Load persisted state from storage. */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved && (saved.savedAnalyticsQueries?.length > 0 || saved.dashboards?.length > 0)) {
			this.state = saved;
		}

		// Migration: wrap single SortSpec in array for backward compatibility
		for (const q of this.state.savedAnalyticsQueries ?? []) {
			if (q.sort && !Array.isArray(q.sort)) {
				q.sort = [q.sort as unknown as SortSpec];
			}
		}

		await this.eventBus?.emit("analytics.loaded", {
			queryCount: this.state.savedAnalyticsQueries?.length ?? 0,
			dashboardCount: this.state.dashboards?.length ?? 0,
			measurementCount: this.state.measurements?.length ?? 0,
		});
	}

	/** Reset all analytics state — clears queries, dashboards, templates, and measurements. */
	async reset(): Promise<void> {
		this.state = createDefaultState();
		this.queryCache.clear();
		await this.storage.save(this.state);
		await this.eventBus?.emit("analytics.reset", {});
	}

	// ── Onboarding checklist (legacy, migration support) ─────

	/** Get the legacy onboarding checklist for migration to OnboardingService. */
	getOnboardingChecklist(): OnboardingChecklist | undefined {
		return this.state.onboardingChecklist;
	}

	/** Set the CSV reading callback (wired during setup). */
	setReadCsv(cb: ReadCsvCallback): void {
		this.readCsv = cb;
	}

	/** Set the vault folder where saved queries are written as JSON files. */
	setQueryFolder(folder: string): void {
		this.queryFolder = folder;
	}

	/** Set the analytics folder — derives queryFolder as `folder + "/Queries"`. */
	setAnalyticsFolder(folder: string): void {
		this.queryFolder = `${folder}/Queries`;
	}

	/** Set the base analytics adapter (wired during setup). */
	setBaseAdapter(adapter: BaseAnalyticsAdapter): void {
		this.baseAdapter = adapter;
	}

	/** Set the folder listing callback for csv-folder sources (wired during setup). */
	setListFolder(cb: (folderPath: string) => Promise<string[]>): void {
		this.listFolder = cb;
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

	/** Load and merge all CSV files from a folder into ParsedSourceData. */
	async loadCsvFolder(folderPath: string): Promise<ParsedSourceData | null> {
		if (!this.listFolder || !this.readCsv) return null;
		const src: SavedAnalyticsQuerySource = { alias: "", csvPath: folderPath, sourceType: "csv-folder" };
		return this.resolveSource(src);
	}

	// ── Query execution ──────────────────────────────────

	/** Clear the saved-query result cache (call on source changes or schema edits). */
	clearQueryCache(): void {
		this.queryCache.clear();
	}

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

			void this.eventBus?.emit("perf.query.executed", {
				queryId: queryName ?? "ad-hoc",
				durationMs,
				sourceRows: result.sourceRowCount,
				resultRows: result.rows.length,
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

		// Check cache before loading sources (skip disk I/O + engine execution)
		const cached = this.queryCache.get(queryId);
		if (cached) return cached;

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

		// Cache the result for subsequent reads
		this.queryCache.set(queryId, result);

		// Update last run metadata
		saved.lastRun = Date.now();
		saved.lastRowCount = result.rows.length;
		await this.storage.save(this.state);

		return result;
	}

	/**
	 * Run a saved query with additional dashboard-level filters.
	 *
	 * - Dimension filters (extraFilters) are applied AFTER aggregation (post-filter)
	 *   because filter values come from the result data.
	 * - Date range filter is applied BEFORE aggregation (pre-filter) in the engine
	 *   because it operates on raw date column values.
	 *
	 * Filters for columns not present in the result are silently skipped.
	 */
	async runSavedQueryWithFilters(
		queryId: string,
		extraFilters: Array<{ column: string; values: string[] }>,
		dateRangeFilter?: QueryDateRangeFilter,
	): Promise<AnalyticsResult> {
		let result: AnalyticsResult;

		if (dateRangeFilter) {
			// Date range is pre-aggregation — rebuild and run query with filter injected
			const saved = this.getQuery(queryId);
			if (!saved) throw new Error(`Saved query not found: ${queryId}`);

			const sources: AnalyticsSource[] = [];
			for (const src of saved.sources) {
				const data = await this.resolveSource(src);
				sources.push({ alias: src.alias, data, locale: src.locale });
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
				dateRangeFilter,
			};

			result = await this.runQuery(query, saved.name);
		} else {
			result = await this.runSavedQuery(queryId);
		}

		// Post-filter the result rows by dimension filters
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

		void this.eventBus?.emit("analytics.query.saved", {
			queryId: saved.id,
			queryName: saved.name,
		});

		void this.writeQueryFile(saved);

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

	/** Get saved queries that reference a specific source file path. */
	getQueriesBySource(csvPath: string): SavedAnalyticsQuery[] {
		return this.listQueries().filter((q) => q.sources.some((s) => s.csvPath === csvPath));
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

		// Invalidate cached result for this query (config changed)
		this.queryCache.invalidate(id);

		void this.eventBus?.emit("analytics.query.saved", {
			queryId: existing.id,
			queryName: existing.name,
		});

		void this.writeQueryFile(existing);

		return existing;
	}

	/** Delete a saved query by ID. Cascades: removes linked measurements and clears tile measurementIds. */
	async deleteQuery(id: string): Promise<boolean> {
		const queries = this.state.savedAnalyticsQueries ?? [];
		const idx = queries.findIndex((q) => q.id === id);
		if (idx === -1) return false;

		this.queryCache.invalidate(id);

		const removed = queries[idx];
		queries.splice(idx, 1);
		this.state.savedAnalyticsQueries = queries;

		// Cascade: delete measurements linked to this query
		const orphanMeasurements = (this.state.measurements ?? []).filter((m) => m.queryId === id);
		for (const m of orphanMeasurements) {
			await dashboardHandlers.clearMeasurementFromTiles(this.ctx(), m.id);
		}
		this.state.measurements = (this.state.measurements ?? []).filter((m) => m.queryId !== id);

		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.deleted", {
			queryId: removed.id,
			queryName: removed.name,
		});

		await this.deleteQueryFile(removed.name);

		return true;
	}

	// ── Dashboard CRUD (delegated to handlers) ──────────

	listDashboards(): Dashboard[] { return dashboardHandlers.listDashboards(this.ctx()); }
	getDashboard(id: string): Dashboard | undefined { return dashboardHandlers.getDashboard(this.ctx(), id); }
	async createDashboard(name: string, description?: string): Promise<Dashboard> { return dashboardHandlers.createDashboard(this.ctx(), name, description); }
	async updateDashboard(id: string, changes: { name?: string; description?: string }): Promise<Dashboard | undefined> { return dashboardHandlers.updateDashboard(this.ctx(), id, changes); }
	async deleteDashboard(id: string): Promise<boolean> { return dashboardHandlers.deleteDashboard(this.ctx(), id); }

	// ── Favorites & Default (delegated to handlers) ─────

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

	async toggleDashboardFavorite(id: string): Promise<boolean | undefined> { return dashboardHandlers.toggleDashboardFavorite(this.ctx(), id); }
	async setDefaultDashboard(id: string | null): Promise<void> { return dashboardHandlers.setDefaultDashboard(this.ctx(), id); }
	getDefaultDashboard(): Dashboard | undefined { return dashboardHandlers.getDefaultDashboard(this.ctx()); }

	// ── Tile CRUD (delegated to handlers) ────────────────

	async addTile(dashboardId: string, queryId: string, displayMode: TileDisplayMode, title?: string): Promise<DashboardTile | undefined> { return dashboardHandlers.addTile(this.ctx(), dashboardId, queryId, displayMode, title); }
	async removeTile(dashboardId: string, tileId: string): Promise<boolean> { return dashboardHandlers.removeTile(this.ctx(), dashboardId, tileId); }
	async updateTile(dashboardId: string, tileId: string, changes: Partial<Omit<DashboardTile, "id">>): Promise<DashboardTile | undefined> { return dashboardHandlers.updateTile(this.ctx(), dashboardId, tileId, changes); }
	async reorderTile(dashboardId: string, tileId: string, direction: "up" | "down"): Promise<boolean> { return dashboardHandlers.reorderTile(this.ctx(), dashboardId, tileId, direction); }

	// ── Filter presets (delegated to handlers) ──────────

	async saveFilterPreset(dashboardId: string, name: string, filters: Array<{ column: string; values: string[] }>): Promise<{ id: string; name: string } | undefined> { return dashboardHandlers.saveFilterPreset(this.ctx(), dashboardId, name, filters); }
	async deleteFilterPreset(dashboardId: string, presetId: string): Promise<boolean> { return dashboardHandlers.deleteFilterPreset(this.ctx(), dashboardId, presetId); }

	// ── Dashboard templates (delegated to handlers) ──────

	listTemplates(): DashboardTemplate[] { return dashboardHandlers.listTemplates(this.ctx()); }
	async saveDashboardAsTemplate(dashboardId: string, name: string, description: string, domain: string): Promise<DashboardTemplate | undefined> { return dashboardHandlers.saveDashboardAsTemplate(this.ctx(), dashboardId, name, description, domain); }
	buildDashboardTemplate(dashboardId: string, name: string, description: string, domain: string): DashboardTemplate | undefined { return dashboardHandlers.buildDashboardTemplate(this.ctx(), dashboardId, name, description, domain); }
	async deleteTemplate(templateId: string): Promise<boolean> { return dashboardHandlers.deleteTemplate(this.ctx(), templateId); }

	/** Get a map of unique queries used by a dashboard's tiles with tile counts. */
	getDashboardQueryMap(dashboardId: string): Map<string, { query: SavedAnalyticsQuery; tileCount: number }> { return dashboardHandlers.getDashboardQueryMap(this.ctx(), dashboardId); }

	/** Collect all unique source file paths used by a dashboard's tiles. */
	getSourcePathsForDashboard(dashboardId: string): string[] {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return [];

		const paths = new Set<string>();
		for (const tile of dashboard.tiles) {
			const measurement = this.listMeasurements().find((m) => m.id === tile.measurementId);
			const queryId = measurement ? measurement.queryId : tile.queryId;
			const query = this.getQuery(queryId);
			if (!query) continue;
			for (const source of query.sources) {
				paths.add(source.csvPath);
			}
		}
		return [...paths];
	}

	/**
	 * Create a new dashboard from a template with source mapping.
	 */
	async createDashboardFromTemplate(
		templateId: string,
		sourceMapping: Record<string, string>,
		dashboardName?: string,
	): Promise<Dashboard | undefined> {
		const template = this.listTemplates().find((t) => t.id === templateId);
		if (!template) return undefined;

		const newQueryIds: string[] = [];
		for (const qt of template.queries) {
			const mappedSources: SavedAnalyticsQuerySource[] = qt.originalSources.map((src) => ({
				...src,
				csvPath: sourceMapping[src.csvPath] ?? src.csvPath,
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

		const dashboard = await this.createDashboard(dashboardName ?? template.name, template.description);

		for (const tt of template.tiles) {
			const queryId = newQueryIds[tt.queryIndex];
			if (!queryId) continue;
			const tile = await this.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
			if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.chartValueColumns || tt.width !== 2 || tt.height !== 1)) {
				await this.updateTile(dashboard.id, tile.id, {
					width: tt.width, height: tt.height,
					conditionalRules: tt.conditionalRules, chartValueColumn: tt.chartValueColumn, chartValueColumns: tt.chartValueColumns,
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
			const saved = await this.saveQuery(qt.queryConfig.name, mappedSources, {
				joins: qt.queryConfig.joins, columnTypeHints: qt.queryConfig.columnTypeHints,
				dimensions: qt.queryConfig.dimensions, measures: qt.queryConfig.measures,
				timeBucket: qt.queryConfig.timeBucket, filters: qt.queryConfig.filters,
				sort: qt.queryConfig.sort, limit: qt.queryConfig.limit,
				computedColumns: qt.queryConfig.computedColumns,
			});
			newQueryIds.push(saved.id);
		}

		const dashboard = await this.createDashboard(template.name, template.description);

		for (const tt of template.tiles) {
			const queryId = newQueryIds[tt.queryIndex];
			if (!queryId) continue;
			const tile = await this.addTile(dashboard.id, queryId, tt.displayMode, tt.title);
			if (tile && (tt.conditionalRules || tt.chartValueColumn || tt.chartValueColumns || tt.width !== 2 || tt.height !== 1)) {
				await this.updateTile(dashboard.id, tile.id, {
					width: tt.width, height: tt.height,
					conditionalRules: tt.conditionalRules, chartValueColumn: tt.chartValueColumn, chartValueColumns: tt.chartValueColumns,
				});
			}
		}

		return dashboard;
	}

	// ── Measurement CRUD ─────────────────────────────────

	listMeasurements(): Measurement[] { return measurementHandlers.listMeasurements(this.ctx()); }
	getMeasurement(id: string): Measurement | undefined { return measurementHandlers.getMeasurement(this.ctx(), id); }

	async createMeasurement(
		name: string, queryId: string, type: MeasurementType,
		measureColumn?: string, displayFormat?: NumberDisplayFormat, description?: string,
	): Promise<Measurement> {
		return measurementHandlers.createMeasurement(this.ctx(), name, queryId, type, measureColumn, displayFormat, description);
	}

	async updateMeasurement(id: string, changes: Partial<Pick<Measurement, "name" | "description" | "type" | "queryId" | "measureColumn" | "displayFormat">>): Promise<Measurement | undefined> {
		return measurementHandlers.updateMeasurement(this.ctx(), id, changes);
	}

	async deleteMeasurement(id: string): Promise<boolean> {
		return measurementHandlers.deleteMeasurement(this.ctx(), id);
	}

	async toggleMeasurementFavorite(id: string): Promise<Measurement | undefined> {
		return measurementHandlers.toggleFavorite(this.ctx(), id);
	}

	/**
	 * Auto-create measurements for query measures that don't have one yet.
	 * Called after saving/updating a query to keep measurement catalog in sync.
	 */
	async syncMeasurementsFromQuery(queryId: string): Promise<void> {
		const query = this.getQuery(queryId);
		if (!query || (query.measures.length === 0 && (!query.computedColumns || query.computedColumns.length === 0))) return;

		const existing = this.listMeasurements().filter((m) => m.queryId === queryId);

		for (const measure of query.measures) {
			const label = measure.label ?? `${measure.function}(${measure.column})`;
			const alreadyExists = existing.some((m) => m.measureColumn === label || m.name === label);
			if (!alreadyExists) {
				await this.createMeasurement(label, queryId, "single", label);
			}
		}

		for (const computed of query.computedColumns ?? []) {
			const name = computed.name.trim();
			if (!name) continue;
			const alreadyExists = existing.some((m) => m.measureColumn === name || m.name === name);
			if (!alreadyExists) {
				await this.createMeasurement(name, queryId, "single", name);
			}
		}
	}

	// ── Source resolution ────────────────────────────────

	/** Resolve a saved query source to ParsedSourceData, regardless of type. */
	private async resolveSource(src: SavedAnalyticsQuerySource): Promise<ParsedSourceData> {
		if (src.sourceType === "base") {
			if (!this.baseAdapter) throw new Error("Base adapter not configured");
			return this.baseAdapter.resolve(src.csvPath, src.viewIndex ?? 0);
		}

		if (src.sourceType === "csv-folder") {
			if (!this.listFolder) throw new Error("Folder listing not configured");
			if (!this.readCsv) throw new Error("CSV reader not configured");
			const files = await this.listFolder(src.csvPath);
			const csvFiles = files.filter((f) => f.endsWith(".csv")).sort();
			if (csvFiles.length === 0) throw new Error(`No CSV files in folder: ${src.csvPath}`);

			// Build union of all headers across files, pad rows for missing columns
			const headerSet = new Set<string>();
			const headerOrder: string[] = [];
			const fileResults: Array<{ headers: string[]; rows: string[][] }> = [];
			for (const file of csvFiles) {
				const parsed = await this.readCsv(file);
				if (!parsed) continue;
				for (const h of parsed.headers) {
					if (!headerSet.has(h)) {
						headerSet.add(h);
						headerOrder.push(h);
					}
				}
				fileResults.push(parsed);
			}

			const mergedRows: string[][] = [];
			for (const fr of fileResults) {
				const colIndex = headerOrder.map((h) => fr.headers.indexOf(h));
				for (const row of fr.rows) {
					mergedRows.push(colIndex.map((idx) => (idx >= 0 ? row[idx] : "")));
				}
			}
			return { headers: headerOrder, rows: mergedRows };
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
