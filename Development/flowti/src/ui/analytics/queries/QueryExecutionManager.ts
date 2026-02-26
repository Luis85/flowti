/**
 * Query Execution Manager — owns query execution orchestration,
 * execution state (running, result, error), and CSV export.
 *
 * Extracted from QueriesTab (PBI-ANA-140, Cycle 44) to separate
 * execution concerns from rendering orchestration.
 *
 * Follows the callback-based deps pattern established by SourceManager (C43).
 */

import type {
	AnalyticsQuery,
	AnalyticsResult,
	AnalyticsSource,
	QuerySource,
} from "../../../domain/analytics/types";

export interface QueryExecutionDeps {
	/** Get active query sources with their loaded data. */
	getSources(): QuerySource[];
	/** Build query config (joins, dims, measures, etc.) from current state. */
	getQueryConfig(): Omit<AnalyticsQuery, "sources">;
	/** Execute query through analytics service. */
	runQuery(query: AnalyticsQuery): Promise<AnalyticsResult>;
	/** Called when execution state changes (start, complete, fail). */
	onStateChanged(): void;
}

export class QueryExecutionManager {
	private _running = false;
	private _result: AnalyticsResult | null = null;
	private _durationMs: number | undefined;
	private _error: string | null = null;

	constructor(private deps: QueryExecutionDeps) {}

	// ── Accessors ────────────────────────────────────────────

	get running(): boolean { return this._running; }
	get result(): AnalyticsResult | null { return this._result; }
	get durationMs(): number | undefined { return this._durationMs; }
	get error(): string | null { return this._error; }

	// ── Execution ────────────────────────────────────────────

	async execute(): Promise<void> {
		this._running = true;
		this._error = null;
		this._result = null;
		this._durationMs = undefined;
		this.deps.onStateChanged();

		const start = Date.now();
		try {
			const sources: AnalyticsSource[] = this.deps.getSources()
				.filter((s) => s.data)
				.map((s) => ({
					alias: s.alias,
					data: s.data!,
					locale: s.locale !== "auto" ? s.locale : undefined,
				}));

			const config = this.deps.getQueryConfig();
			const query: AnalyticsQuery = { sources, ...config };

			this._result = await this.deps.runQuery(query);
			this._durationMs = Date.now() - start;
		} catch (err) {
			this._error = err instanceof Error ? err.message : String(err);
		} finally {
			this._running = false;
			this.deps.onStateChanged();
		}
	}

	reset(): void {
		this._running = false;
		this._result = null;
		this._durationMs = undefined;
		this._error = null;
	}
}
