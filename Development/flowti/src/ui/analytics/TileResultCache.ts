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

export const MAX_ENTRIES = 100;
export const TTL_MS = 15 * 60 * 1000; // 15 minutes — aligned with freshnessUtils "stale" threshold

export class TileResultCache {
	private cache = new Map<string, TileCacheEntry>();
	private timestamps = new Map<string, number>();

	/**
	 * Get cached result for a query, or kick off async execution.
	 * Returns { result: null, error: null } while loading.
	 * Evicts expired entries (TTL) and enforces LRU size cap.
	 */
	tryRun(queryId: string, runner: QueryRunner, onDone: () => void): TileCacheEntry {
		// Evict if expired
		const ts = this.timestamps.get(queryId);
		if (ts && Date.now() - ts > TTL_MS) {
			this.cache.delete(queryId);
			this.timestamps.delete(queryId);
		}

		const cached = this.cache.get(queryId);
		if (cached) return cached;

		// Evict oldest entries if at capacity
		this.evictExpired();
		if (this.cache.size >= MAX_ENTRIES) this.evictOldest();

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

	/** Clear all cached entries whose key starts with the given query ID (covers all filter variants). */
	clearByQueryId(queryId: string): void {
		for (const key of [...this.cache.keys()]) {
			if (key === queryId || key.startsWith(queryId + "?")) {
				this.cache.delete(key);
				this.timestamps.delete(key);
			}
		}
	}

	/** Number of cached entries. */
	size(): number {
		return this.cache.size;
	}

	/** Remove all entries whose TTL has expired. */
	private evictExpired(): void {
		const now = Date.now();
		for (const [key, ts] of this.timestamps) {
			if (now - ts > TTL_MS) {
				this.cache.delete(key);
				this.timestamps.delete(key);
			}
		}
	}

	/** Remove the oldest entry by timestamp (LRU). */
	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTs = Infinity;
		for (const [key, ts] of this.timestamps) {
			if (ts < oldestTs) { oldestTs = ts; oldestKey = key; }
		}
		if (oldestKey) {
			this.cache.delete(oldestKey);
			this.timestamps.delete(oldestKey);
		}
	}
}
