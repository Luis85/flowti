import { describe, expect, it, vi, beforeEach } from "vitest";
import { TileResultCache, MAX_ENTRIES, TTL_MS } from "../../../src/ui/analytics/TileResultCache";
import type { AnalyticsResult } from "../../../src/domain/analytics/types";

const fakeResult: AnalyticsResult = {
	columns: ["x"],
	rows: [{ x: 1 }],
	groupCount: 1,
	sourceRowCount: 1,
};

describe("TileResultCache", () => {
	let cache: TileResultCache;
	let onDone: () => void;

	beforeEach(() => {
		cache = new TileResultCache();
		onDone = vi.fn() as unknown as () => void;
	});

	it("returns loading state on first call then caches result", async () => {
		const runner = vi.fn(async () => fakeResult);
		const entry = cache.tryRun("q1", runner, onDone);
		expect(entry.result).toBeNull();
		expect(entry.error).toBeNull();
		expect(runner).toHaveBeenCalledWith("q1");

		// Wait for async
		await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

		const cached = cache.tryRun("q1", runner, onDone);
		expect(cached.result).toEqual(fakeResult);
		expect(runner).toHaveBeenCalledTimes(1); // not called again
	});

	it("caches errors", async () => {
		const runner = vi.fn(async () => { throw new Error("fail"); });
		cache.tryRun("q1", runner, onDone);

		await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

		const cached = cache.get("q1");
		expect(cached?.error).toBe("fail");
		expect(cached?.result).toBeNull();
	});

	it("expires entries after TTL", async () => {
		const runner = vi.fn(async () => fakeResult);
		cache.tryRun("q1", runner, onDone);
		await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

		// Manually set timestamp to past
		const privateTimestamps = (cache as unknown as { timestamps: Map<string, number> }).timestamps;
		privateTimestamps.set("q1", Date.now() - TTL_MS - 1);

		// Next tryRun should trigger re-run
		const runner2 = vi.fn(async () => fakeResult);
		const onDone2 = vi.fn() as unknown as () => void;
		const entry = cache.tryRun("q1", runner2, onDone2);
		expect(entry.result).toBeNull(); // loading state, re-fetching
		expect(runner2).toHaveBeenCalledWith("q1");
	});

	it("evicts oldest entry when at capacity", async () => {
		// Fill cache to MAX_ENTRIES
		const privateTimestamps = (cache as unknown as { timestamps: Map<string, number> }).timestamps;
		const privateCache = (cache as unknown as { cache: Map<string, unknown> }).cache;

		const now = Date.now();
		for (let i = 0; i < MAX_ENTRIES; i++) {
			const key = `q${i}`;
			privateCache.set(key, { result: fakeResult, error: null });
			privateTimestamps.set(key, now - MAX_ENTRIES + i); // q0 is oldest, all within TTL
		}

		expect(cache.size()).toBe(MAX_ENTRIES);

		// Adding one more should evict q0 (oldest timestamp)
		const runner = vi.fn(async () => fakeResult);
		cache.tryRun("qNew", runner, onDone);

		expect(cache.get("q0")).toBeUndefined(); // evicted
		expect(cache.size()).toBe(MAX_ENTRIES); // old was removed, new placeholder added
	});

	it("clearOne removes a single entry", async () => {
		const runner = vi.fn(async () => fakeResult);
		cache.tryRun("q1", runner, onDone);
		await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

		cache.clearOne("q1");
		expect(cache.get("q1")).toBeUndefined();
		expect(cache.getTimestamp("q1")).toBeUndefined();
	});

	it("clear removes all entries", async () => {
		const runner = vi.fn(async () => fakeResult);
		cache.tryRun("q1", runner, onDone);
		cache.tryRun("q2", runner, onDone);
		await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(2));

		cache.clear();
		expect(cache.size()).toBe(0);
		expect(cache.get("q1")).toBeUndefined();
		expect(cache.get("q2")).toBeUndefined();
	});

	it("size() returns number of cached entries", async () => {
		expect(cache.size()).toBe(0);
		const runner = vi.fn(async () => fakeResult);
		cache.tryRun("q1", runner, onDone);
		expect(cache.size()).toBe(1);
	});

	describe("clearByQueryId", () => {
		it("clears exact queryId entry", async () => {
			const runner = vi.fn(async () => fakeResult);
			cache.tryRun("q1", runner, onDone);
			await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

			cache.clearByQueryId("q1");
			expect(cache.get("q1")).toBeUndefined();
			expect(cache.getTimestamp("q1")).toBeUndefined();
		});

		it("clears all filter-variant entries for a queryId", async () => {
			const runner = vi.fn(async () => fakeResult);
			cache.tryRun("q1", runner, onDone);
			cache.tryRun("q1?region=EMEA", runner, onDone);
			cache.tryRun("q1?region=EMEA&dr=date:2026-1-1..2026-1-31", runner, onDone);
			cache.tryRun("q2", runner, onDone);
			await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(4));

			cache.clearByQueryId("q1");
			expect(cache.get("q1")).toBeUndefined();
			expect(cache.get("q1?region=EMEA")).toBeUndefined();
			expect(cache.get("q1?region=EMEA&dr=date:2026-1-1..2026-1-31")).toBeUndefined();
			expect(cache.get("q2")).toBeDefined(); // not affected
		});

		it("does not clear entries for a different queryId with similar prefix", async () => {
			const runner = vi.fn(async () => fakeResult);
			cache.tryRun("q1", runner, onDone);
			cache.tryRun("q10", runner, onDone);
			await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(2));

			cache.clearByQueryId("q1");
			expect(cache.get("q1")).toBeUndefined();
			expect(cache.get("q10")).toBeDefined(); // q10 is NOT q1
		});
	});
});
