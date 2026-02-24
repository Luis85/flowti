/**
 * Shared async cache for dashboard tile query results.
 *
 * Extracted from DashboardsTab for reuse by AnalyticsDashboardPage (overview).
 * Kicks off async query execution on first access; callers re-render when results arrive.
 */

import type { AnalyticsResult } from "../../domain/analytics/types";

export interface TileCacheEntry {
	result: AnalyticsResult | null;
	error: string | null;
}

export type QueryRunner = (queryId: string) => Promise<AnalyticsResult>;

export class TileResultCache {
	private cache = new Map<string, TileCacheEntry>();
	private timestamps = new Map<string, number>();

	/**
	 * Get cached result for a query, or kick off async execution.
	 * Returns { result: null, error: null } while loading.
	 */
	tryRun(queryId: string, runner: QueryRunner, onDone: () => void): TileCacheEntry {
		const cached = this.cache.get(queryId);
		if (cached) return cached;

		// Start async load
		this.cache.set(queryId, { result: null, error: null });
		void runner(queryId).then(
			(result) => {
				this.cache.set(queryId, { result, error: null });
				this.timestamps.set(queryId, Date.now());
				onDone();
			},
			(err) => {
				const message = err instanceof Error ? err.message : String(err);
				this.cache.set(queryId, { result: null, error: message });
				onDone();
			},
		);

		return { result: null, error: null };
	}

	/** Get a cached entry without triggering execution. */
	get(queryId: string): TileCacheEntry | undefined {
		return this.cache.get(queryId);
	}

	/** Get the timestamp when a query result was last cached. */
	getTimestamp(queryId: string): number | undefined {
		return this.timestamps.get(queryId);
	}

	/** Clear all cached results and timestamps. */
	clear(): void {
		this.cache.clear();
		this.timestamps.clear();
	}

	/** Clear a single query's cached result and timestamp (for refresh). */
	clearOne(queryId: string): void {
		this.cache.delete(queryId);
		this.timestamps.delete(queryId);
	}
}
