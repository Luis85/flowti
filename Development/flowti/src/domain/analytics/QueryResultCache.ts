/**
 * LRU cache for analytics query results.
 *
 * Keyed by a deterministic hash of query configuration (filters, sort, dimensions, etc.).
 * Used by the dashboard tile rendering pipeline to avoid re-executing identical queries.
 *
 * PBI-ANA-121 (Cycle 43) — Render Performance.
 */

import type { AnalyticsResult } from "./types";

export interface QueryResultCacheEntry {
	result: AnalyticsResult;
	timestamp: number;
}

export const MAX_CACHE_ENTRIES = 20;

export class QueryResultCache {
	private cache = new Map<string, QueryResultCacheEntry>();

	/**
	 * Look up a cached result by cache key.
	 * Returns the cached AnalyticsResult or undefined on miss.
	 */
	get(key: string): AnalyticsResult | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;
		// Move to end (most recently used)
		this.cache.delete(key);
		this.cache.set(key, entry);
		return entry.result;
	}

	/**
	 * Store a result in the cache, evicting LRU entry if at capacity.
	 */
	set(key: string, result: AnalyticsResult): void {
		// If key exists, delete to refresh insertion order
		if (this.cache.has(key)) this.cache.delete(key);

		// Evict oldest (first inserted) if at capacity
		if (this.cache.size >= MAX_CACHE_ENTRIES) {
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) this.cache.delete(oldest);
		}

		this.cache.set(key, { result, timestamp: Date.now() });
	}

	/** Check if a key exists in the cache. */
	has(key: string): boolean {
		return this.cache.has(key);
	}

	/** Invalidate a specific entry by key. */
	invalidate(key: string): void {
		this.cache.delete(key);
	}

	/** Invalidate all entries whose key starts with the given prefix. */
	invalidateByPrefix(prefix: string): void {
		for (const key of [...this.cache.keys()]) {
			if (key.startsWith(prefix)) this.cache.delete(key);
		}
	}

	/** Clear all entries. */
	clear(): void {
		this.cache.clear();
	}

	/** Number of cached entries. */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Build a deterministic cache key from query configuration.
	 * Includes queryId + filter/sort/dimension/measure/limit specs.
	 */
	static buildKey(queryId: string, config: Record<string, unknown>): string {
		return `${queryId}:${JSON.stringify(config)}`;
	}
}
