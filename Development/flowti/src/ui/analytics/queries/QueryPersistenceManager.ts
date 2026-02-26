/**
 * Query Persistence Manager — owns save/load/dirty tracking
 * and query state lifecycle (new, load, reset).
 *
 * Extracted from QueriesTab (PBI-ANA-140, Cycle 44) to separate
 * persistence concerns from rendering orchestration.
 *
 * Follows the callback-based deps pattern established by SourceManager (C43).
 */

import type { SourceManager } from "../../../domain/analytics/SourceManager";
import type {
	ColumnTypeHint,
	JoinSpec,
	DimensionSpec,
	MeasureSpec,
	TimeBucketSpec,
	FilterSpec,
	SortSpec,
	ComputedColumn,
	AnalyticsQuery,
	SavedAnalyticsQuery,
} from "../../../domain/analytics/types";

// ─────────────────────────────────────────────────────────────
// Query state snapshot — all mutable query configuration fields
// ─────────────────────────────────────────────────────────────

export interface QueryStateSnapshot {
	columnTypeHints: ColumnTypeHint[];
	joins: JoinSpec[];
	dimensions: DimensionSpec[];
	measures: MeasureSpec[];
	timeBucket: TimeBucketSpec | null;
	filters: FilterSpec[];
	sort: SortSpec[];
	limit: number | null;
	computedColumns: ComputedColumn[];
	excludedColumns: string[];
}

// ─────────────────────────────────────────────────────────────
// Deps
// ─────────────────────────────────────────────────────────────

export interface QueryPersistenceDeps {
	sourceManager: SourceManager;
	/** Build query config from current state (used for snapshot + save). */
	getQueryConfig(): Omit<AnalyticsQuery, "sources">;
	/** Replace all query state fields from a loaded/reset snapshot. */
	setQueryState(state: QueryStateSnapshot): void;
	/** Get selected query ID from hub state. */
	getSelectedQueryId(): string | null;
	/** Set selected query ID in hub state. */
	setSelectedQueryId(id: string | null): void;
	/** Schedule a render for master/detail panels. */
	scheduleRender(master: boolean, detail: boolean): void;

	// Analytics service operations
	saveQuery(name: string, sources: ReturnType<SourceManager["buildSavedSources"]>, config: Omit<AnalyticsQuery, "sources">): Promise<SavedAnalyticsQuery>;
	updateQuery(queryId: string, sources: ReturnType<SourceManager["buildSavedSources"]>, config: Omit<AnalyticsQuery, "sources">): Promise<unknown>;
	getQuery(queryId: string): SavedAnalyticsQuery | undefined;
	syncMeasurementsFromQuery(queryId: string): Promise<void>;
}

export class QueryPersistenceManager {
	private _savedSnapshot: string | null = null;
	private _lastLoadedQueryId: string | null = null;
	private _queryName = "";

	constructor(private deps: QueryPersistenceDeps) {}

	// ── Accessors ────────────────────────────────────────────

	get queryName(): string { return this._queryName; }
	set queryName(name: string) { this._queryName = name; }

	get lastLoadedQueryId(): string | null { return this._lastLoadedQueryId; }
	set lastLoadedQueryId(id: string | null) { this._lastLoadedQueryId = id; }

	// ── Dirty tracking ───────────────────────────────────────

	private takeSnapshot(): string {
		return JSON.stringify(this.deps.getQueryConfig());
	}

	isDirty(hasMeasures: boolean): boolean {
		if (!this._savedSnapshot) return hasMeasures;
		return this.takeSnapshot() !== this._savedSnapshot;
	}

	updateSnapshot(): void {
		this._savedSnapshot = this.takeSnapshot();
	}

	// ── Save / Update ────────────────────────────────────────

	async save(): Promise<void> {
		const name = this._queryName.trim() || `Query ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
		const sources = this.deps.sourceManager.buildSavedSources();
		const config = this.deps.getQueryConfig();

		const saved = await this.deps.saveQuery(name, sources, config);
		this._savedSnapshot = this.takeSnapshot();
		this.deps.setSelectedQueryId(saved.id);
		this.deps.scheduleRender(true, false);
		void this.deps.syncMeasurementsFromQuery(saved.id);
	}

	async update(): Promise<void> {
		const queryId = this.deps.getSelectedQueryId();
		if (!queryId) return;

		const sources = this.deps.sourceManager.buildSavedSources();
		const config = this.deps.getQueryConfig();

		await this.deps.updateQuery(queryId, sources, config);
		this._savedSnapshot = this.takeSnapshot();
		this.deps.scheduleRender(true, false);
		void this.deps.syncMeasurementsFromQuery(queryId);
	}

	// ── Load ─────────────────────────────────────────────────

	load(queryId: string): void {
		const saved = this.deps.getQuery(queryId);
		if (!saved) return;

		this._lastLoadedQueryId = queryId;

		this.deps.setQueryState({
			columnTypeHints: [...saved.columnTypeHints],
			joins: [...saved.joins],
			dimensions: [...saved.dimensions],
			measures: [...saved.measures],
			timeBucket: saved.timeBucket ? { ...saved.timeBucket } : null,
			filters: saved.filters ? saved.filters.map((f) => ({ ...f })) : [],
			sort: saved.sort ? saved.sort.map((s) => ({ ...s })) : [],
			limit: saved.limit ?? null,
			computedColumns: saved.computedColumns ? saved.computedColumns.map((c) => ({ ...c })) : [],
			excludedColumns: saved.excludedColumns ? [...saved.excludedColumns] : [],
		});
		this._savedSnapshot = this.takeSnapshot();

		this.deps.sourceManager.loadFromSaved(saved.sources, true);
		this.deps.scheduleRender(true, true);
	}

	// ── New / Reset ──────────────────────────────────────────

	newQuery(): void {
		this.deps.sourceManager.reset();
		this.deps.setQueryState({
			columnTypeHints: [],
			joins: [],
			dimensions: [],
			measures: [],
			timeBucket: null,
			filters: [],
			sort: [],
			limit: null,
			computedColumns: [],
			excludedColumns: [],
		});
		this._savedSnapshot = null;
		this._lastLoadedQueryId = null;
		this._queryName = "";
		this.deps.setSelectedQueryId(null);
		this.deps.scheduleRender(true, true);
	}

	reset(): void {
		this._savedSnapshot = null;
		this._lastLoadedQueryId = null;
		this._queryName = "";
	}
}
