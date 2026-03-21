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
	Dashboard,
	DashboardTile,
	DashboardTemplate,
	Measurement,
	MeasurementType,
	NumberDisplayFormat,
	OnboardingChecklist,
	ParsedSourceData,
	SavedAnalyticsQuery,
	QueryDateRangeFilter,
	SavedAnalyticsQuerySource,
	SortSpec,
	TileDisplayMode,
} from "./types";
import { AnalyticsEngine } from "./AnalyticsEngine";
import { QueryResultCache } from "./QueryResultCache";
import type { BaseAnalyticsAdapter } from "./BaseAnalyticsAdapter";
import type { AnalyticsHandlerContext } from "./handlers/types";
import { dashboardHandlers, measurementHandlers } from "./handlers";

import { resolveSource, resolveCsvFolder, type ReadCsvCallback } from "./AnalyticsService-sources";

/** Re-export for consumers that import from AnalyticsService. */
export type { ReadCsvCallback } from "./AnalyticsService-sources";

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

	/** Returns true if the saved state has meaningful data worth restoring. */
	private hasData(saved: AnalyticsState): boolean {
		return (saved.savedAnalyticsQueries?.length ?? 0) > 0
			|| (saved.dashboards?.length ?? 0) > 0
			|| (saved.measurements?.length ?? 0) > 0;
	}

	/** Migration: wrap single SortSpec in array for backward compatibility. */
	private migrateSortSpecs(): void {
		for (const q of this.state.savedAnalyticsQueries ?? []) {
			if (q.sort && !Array.isArray(q.sort)) {
				q.sort = [q.sort as unknown as SortSpec];
			}
		}
	}

	/** Load persisted state from storage. */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved && this.hasData(saved)) {
			this.state = saved;
		}

		this.migrateSortSpecs();

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
		return resolveCsvFolder(folderPath, this.listFolder, this.readCsv);
	}

	// ── Query execution ──────────────────────────────────

	/** Clear the saved-query result cache (call on source changes or schema edits). */
	clearQueryCache(): void {
		this.queryCache.clear();
	}

	/** Execute an analytics query with pre-loaded source data. */
	async runQuery(query: AnalyticsQuery, queryName?: string): Promise<AnalyticsResult> {
		await this.eventBus?.emit("analytics.query.started", { queryName, sourceCount: query.sources.length, dimensionCount: query.dimensions.length, measureCount: query.measures.length });
		const start = Date.now();
		try {
			const result = this.engine.run(query);
			const durationMs = Date.now() - start;
			await this.eventBus?.emit("analytics.query.completed", { queryName, rowCount: result.rows.length, groupCount: result.groupCount, durationMs, result });
			void this.eventBus?.emit("perf.query.executed", { queryId: queryName ?? "ad-hoc", durationMs, sourceRows: result.sourceRowCount, resultRows: result.rows.length });
			return result;
		} catch (err) {
			await this.eventBus?.emit("analytics.query.failed", { queryName, error: err instanceof Error ? err.message : String(err) });
			throw err;
		}
	}

	/** Execute a saved query by ID. Loads sources from vault, builds query, and runs engine. */
	async runSavedQuery(queryId: string): Promise<AnalyticsResult> {
		const saved = this.getQuery(queryId);
		if (!saved) throw new Error(`Saved query not found: ${queryId}`);
		const cached = this.queryCache.get(queryId);
		if (cached) return cached;
		const sources: AnalyticsSource[] = [];
		for (const src of saved.sources) {
			sources.push({ alias: src.alias, data: await this.resolveSourceInternal(src), locale: src.locale });
		}
		const result = await this.runQuery({
			sources, joins: saved.joins, columnTypeHints: saved.columnTypeHints,
			dimensions: saved.dimensions, measures: saved.measures, timeBucket: saved.timeBucket,
			filters: saved.filters, sort: saved.sort, limit: saved.limit, computedColumns: saved.computedColumns,
		}, saved.name);
		this.queryCache.set(queryId, result);
		saved.lastRun = Date.now();
		saved.lastRowCount = result.rows.length;
		await this.storage.save(this.state);
		return result;
	}

	/**
	 * Run a saved query with additional dashboard-level filters.
	 * Dimension filters are post-aggregation; date range is pre-aggregation.
	 */
	async runSavedQueryWithFilters(
		queryId: string,
		extraFilters: Array<{ column: string; values: string[] }>,
		dateRangeFilter?: QueryDateRangeFilter,
	): Promise<AnalyticsResult> {
		let result: AnalyticsResult;
		if (dateRangeFilter) {
			const saved = this.getQuery(queryId);
			if (!saved) throw new Error(`Saved query not found: ${queryId}`);
			const sources: AnalyticsSource[] = [];
			for (const src of saved.sources) {
				sources.push({ alias: src.alias, data: await this.resolveSourceInternal(src), locale: src.locale });
			}
			result = await this.runQuery({
				sources, joins: saved.joins, columnTypeHints: saved.columnTypeHints,
				dimensions: saved.dimensions, measures: saved.measures, timeBucket: saved.timeBucket,
				filters: saved.filters, sort: saved.sort, limit: saved.limit,
				computedColumns: saved.computedColumns, dateRangeFilter,
			}, saved.name);
		} else {
			result = await this.runSavedQuery(queryId);
		}
		if (extraFilters.length === 0) return result;
		const filteredRows = result.rows.filter((row) =>
			extraFilters.every((f) => { const val = row[f.column]; return val === undefined || f.values.includes(String(val)); }),
		);
		return { ...result, rows: filteredRows, groupCount: filteredRows.length };
	}

	// ── Saved query CRUD ─────────────────────────────────

	/** Save a new analytics query configuration. */
	async saveQuery(name: string, sources: SavedAnalyticsQuerySource[], query: Omit<AnalyticsQuery, "sources">): Promise<SavedAnalyticsQuery> {
		const saved: SavedAnalyticsQuery = {
			id: generateId(), name, createdAt: Date.now(), sources,
			joins: query.joins, columnTypeHints: query.columnTypeHints,
			dimensions: query.dimensions, measures: query.measures,
			timeBucket: query.timeBucket, filters: query.filters,
			sort: query.sort, limit: query.limit, computedColumns: query.computedColumns,
		};
		(this.state.savedAnalyticsQueries ?? []).push(saved);
		this.state.savedAnalyticsQueries = this.state.savedAnalyticsQueries ?? [saved];
		await this.storage.save(this.state);
		void this.eventBus?.emit("analytics.query.saved", { queryId: saved.id, queryName: saved.name });
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
		if (!query || !newName.trim()) return undefined;
		const oldName = query.name;
		query.name = newName.trim();
		await this.storage.save(this.state);
		await this.eventBus?.emit("analytics.query.renamed", { queryId: query.id, oldName, newName: query.name });
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
		const clone: SavedAnalyticsQuery = { ...structuredClone(original), id: generateId(), name: `${original.name} (copy)`, createdAt: Date.now(), lastRun: undefined, lastRowCount: undefined, isFavorite: undefined };
		(this.state.savedAnalyticsQueries ?? []).push(clone);
		await this.storage.save(this.state);
		await this.eventBus?.emit("analytics.query.duplicated", { originalQueryId: original.id, newQueryId: clone.id, newQueryName: clone.name });
		await this.writeQueryFile(clone);
		return clone;
	}

	/** Update an existing saved query's configuration in place. */
	async updateQuery(id: string, sources: SavedAnalyticsQuerySource[], query: Omit<AnalyticsQuery, "sources">): Promise<SavedAnalyticsQuery | undefined> {
		const existing = this.getQuery(id);
		if (!existing) return undefined;
		existing.sources = sources;
		existing.joins = query.joins; existing.columnTypeHints = query.columnTypeHints;
		existing.dimensions = query.dimensions; existing.measures = query.measures;
		existing.timeBucket = query.timeBucket; existing.filters = query.filters;
		existing.sort = query.sort; existing.limit = query.limit;
		existing.computedColumns = query.computedColumns;
		await this.storage.save(this.state);
		this.queryCache.invalidate(id);
		void this.eventBus?.emit("analytics.query.saved", { queryId: existing.id, queryName: existing.name });
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
		for (const m of (this.state.measurements ?? []).filter((m) => m.queryId === id)) {
			await dashboardHandlers.clearMeasurementFromTiles(this.ctx(), m.id);
		}
		this.state.measurements = (this.state.measurements ?? []).filter((m) => m.queryId !== id);
		await this.storage.save(this.state);
		await this.eventBus?.emit("analytics.query.deleted", { queryId: removed.id, queryName: removed.name });
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
		await this.eventBus?.emit("analytics.query.favorited", { queryId: query.id, queryName: query.name, isFavorite: query.isFavorite });
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
			const m = this.listMeasurements().find((me) => me.id === tile.measurementId);
			const query = this.getQuery(m ? m.queryId : tile.queryId);
			if (query) for (const source of query.sources) paths.add(source.csvPath);
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
		const { createDashboardFromTemplate: create } = await import("./AnalyticsService-templates");
		const dashboard = await create(this, templateId, sourceMapping, dashboardName);
		if (dashboard) {
			const template = this.listTemplates().find((t) => t.id === templateId);
			if (template) {
				await this.eventBus?.emit("analytics.template.used", {
					templateId: template.id,
					dashboardId: dashboard.id,
					dashboardName: dashboard.name,
				});
			}
		}
		return dashboard;
	}

	/** Import a dashboard from a raw JSON template (file import). */
	async importDashboardFromJson(
		template: Parameters<typeof import("./AnalyticsService-templates").importDashboardFromJson>[1],
		sourceMapping?: Record<string, string>,
	): Promise<Dashboard> {
		const { importDashboardFromJson: importFn } = await import("./AnalyticsService-templates");
		return importFn(this, template, sourceMapping);
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

	/** Auto-create measurements for query measures that don't have one yet. */
	async syncMeasurementsFromQuery(queryId: string): Promise<void> {
		const query = this.getQuery(queryId);
		if (!query || (query.measures.length === 0 && (!query.computedColumns || query.computedColumns.length === 0))) return;
		const existing = this.listMeasurements().filter((m) => m.queryId === queryId);
		for (const measure of query.measures) {
			const label = measure.label ?? `${measure.function}(${measure.column})`;
			if (!existing.some((m) => m.measureColumn === label || m.name === label)) await this.createMeasurement(label, queryId, "single", label);
		}
		for (const computed of query.computedColumns ?? []) {
			const name = computed.name.trim();
			if (name && !existing.some((m) => m.measureColumn === name || m.name === name)) await this.createMeasurement(name, queryId, "single", name);
		}
	}

	// ── Source resolution (delegated to AnalyticsService-sources.ts) ─

	private async resolveSourceInternal(src: SavedAnalyticsQuerySource): Promise<ParsedSourceData> {
		return resolveSource(src, this.baseAdapter, this.readCsv, this.listFolder);
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
