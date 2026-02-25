import { describe, expect, it, beforeEach } from "vitest";
import { QueryResultCache, MAX_CACHE_ENTRIES } from "../../../src/domain/analytics/QueryResultCache";
import type { AnalyticsResult } from "../../../src/domain/analytics/types";

function makeResult(rowCount: number): AnalyticsResult {
	return {
		columns: ["A"],
		rows: Array.from({ length: rowCount }, (_, i) => ({ A: i })),
		groupCount: rowCount,
		sourceRowCount: rowCount,
	};
}

describe("QueryResultCache", () => {
	let cache: QueryResultCache;

	beforeEach(() => {
		cache = new QueryResultCache();
	});

	it("returns undefined on cache miss", () => {
		expect(cache.get("nonexistent")).toBeUndefined();
	});

	it("stores and retrieves a result", () => {
		const result = makeResult(5);
		cache.set("q1", result);

		expect(cache.get("q1")).toBe(result);
		expect(cache.size).toBe(1);
	});

	it("overwrites existing entry for same key", () => {
		cache.set("q1", makeResult(5));
		const updated = makeResult(10);
		cache.set("q1", updated);

		expect(cache.get("q1")).toBe(updated);
		expect(cache.size).toBe(1);
	});

	it("reports has() correctly", () => {
		expect(cache.has("q1")).toBe(false);
		cache.set("q1", makeResult(1));
		expect(cache.has("q1")).toBe(true);
	});

	it("invalidates a specific key", () => {
		cache.set("q1", makeResult(1));
		cache.set("q2", makeResult(2));

		cache.invalidate("q1");

		expect(cache.has("q1")).toBe(false);
		expect(cache.has("q2")).toBe(true);
		expect(cache.size).toBe(1);
	});

	it("invalidates by prefix", () => {
		cache.set("dashboard:d1:q1", makeResult(1));
		cache.set("dashboard:d1:q2", makeResult(2));
		cache.set("dashboard:d2:q1", makeResult(3));

		cache.invalidateByPrefix("dashboard:d1:");

		expect(cache.has("dashboard:d1:q1")).toBe(false);
		expect(cache.has("dashboard:d1:q2")).toBe(false);
		expect(cache.has("dashboard:d2:q1")).toBe(true);
		expect(cache.size).toBe(1);
	});

	it("clears all entries", () => {
		cache.set("q1", makeResult(1));
		cache.set("q2", makeResult(2));

		cache.clear();

		expect(cache.size).toBe(0);
		expect(cache.get("q1")).toBeUndefined();
	});

	describe("LRU eviction", () => {
		it("evicts oldest entry when at max capacity", () => {
			for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
				cache.set(`q${i}`, makeResult(i));
			}
			expect(cache.size).toBe(MAX_CACHE_ENTRIES);

			// Adding one more should evict q0 (oldest)
			cache.set("qNew", makeResult(99));

			expect(cache.size).toBe(MAX_CACHE_ENTRIES);
			expect(cache.has("q0")).toBe(false);
			expect(cache.has("qNew")).toBe(true);
			expect(cache.has("q1")).toBe(true);
		});

		it("get() refreshes LRU position", () => {
			for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
				cache.set(`q${i}`, makeResult(i));
			}

			// Access q0 to refresh its position
			cache.get("q0");

			// Now add a new entry — q1 (next oldest) should be evicted, not q0
			cache.set("qNew", makeResult(99));

			expect(cache.has("q0")).toBe(true); // refreshed, not evicted
			expect(cache.has("q1")).toBe(false); // evicted (oldest after q0 refresh)
			expect(cache.has("qNew")).toBe(true);
		});
	});

	describe("buildKey", () => {
		it("produces deterministic key from queryId and config", () => {
			const config = { filters: [{ column: "A", op: "=" }], sort: [{ column: "B" }] };
			const key1 = QueryResultCache.buildKey("q1", config);
			const key2 = QueryResultCache.buildKey("q1", config);

			expect(key1).toBe(key2);
			expect(key1).toContain("q1:");
		});

		it("produces different keys for different configs", () => {
			const key1 = QueryResultCache.buildKey("q1", { filters: [] });
			const key2 = QueryResultCache.buildKey("q1", { filters: [{ column: "A" }] });

			expect(key1).not.toBe(key2);
		});
	});
});
