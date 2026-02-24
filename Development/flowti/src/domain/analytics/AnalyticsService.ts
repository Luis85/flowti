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
	TileDisplayMode,
	ParsedSourceData,
	SavedAnalyticsQuery,
	SavedAnalyticsQuerySource,
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
		};

		const result = await this.runQuery(query, saved.name);

		// Update last run metadata
		saved.lastRun = Date.now();
		saved.lastRowCount = result.rows.length;
		await this.storage.save(this.state);

		return result;
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

	/** Update a tile's properties within a dashboard. */
	async updateTile(dashboardId: string, tileId: string, changes: Partial<Omit<DashboardTile, "id">>): Promise<DashboardTile | undefined> {
		const dashboard = this.getDashboard(dashboardId);
		if (!dashboard) return undefined;

		const tile = dashboard.tiles.find((t) => t.id === tileId);
		if (!tile) return undefined;

		if (changes.queryId !== undefined) tile.queryId = changes.queryId;
		if (changes.title !== undefined) tile.title = changes.title;
		if (changes.displayMode !== undefined) tile.displayMode = changes.displayMode;
		if (changes.row !== undefined) tile.row = changes.row;
		if (changes.col !== undefined) tile.col = changes.col;
		if (changes.width !== undefined) tile.width = changes.width;
		if (changes.height !== undefined) tile.height = changes.height;

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
		await this.fileSystem.createFile(path, JSON.stringify(query, null, 2), { createFolders: true });
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
