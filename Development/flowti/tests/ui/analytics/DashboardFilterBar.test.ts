// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { DashboardFilterBar, type FilterBarDeps } from "../../../src/ui/analytics/DashboardFilterBar";
import type { DashboardTile, AnalyticsResult } from "../../../src/domain/analytics/types";
import { TileResultCache } from "../../../src/ui/analytics/TileResultCache";
import "../../mocks/obsidian-stub";

function makeTile(queryId: string): DashboardTile {
	return {
		id: `t_${queryId}`,
		queryId,
		title: "Test Tile",
		displayMode: "table",
		row: 0,
		col: 0,
		width: 3,
		height: 2,
	};
}

function makeResult(rowCount: number): AnalyticsResult {
	return {
		columns: ["Name", "Amount"],
		rows: Array.from({ length: rowCount }, (_, i) => ({ Name: `Item ${i}`, Amount: i * 10 })),
		groupCount: rowCount,
		sourceRowCount: rowCount,
	};
}

describe("DashboardFilterBar — row-count preview", () => {
	it("shows ~N rows badge when filters are active and cache has results", () => {
		const container = document.createElement("div");
		const tileResultCache = new TileResultCache();

		const tiles = [makeTile("q1"), makeTile("q2")];
		const filters = [{ column: "Region", values: ["US"] }];

		// Pre-populate the cache with filtered results
		const cacheKey1 = `q1?Region=US`;
		const cacheKey2 = `q2?Region=US`;
		// Simulate async completion by directly setting cache entries
		void tileResultCache.tryRun(cacheKey1, () => Promise.resolve(makeResult(15)), () => {});
		void tileResultCache.tryRun(cacheKey2, () => Promise.resolve(makeResult(8)), () => {});

		// Wait for promises to resolve
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				const deps: FilterBarDeps = {
					tiles,
					filters,
					tileResultCache,
					runQuery: vi.fn().mockResolvedValue(makeResult(100)),
					runQueryWithFilters: vi.fn().mockResolvedValue(makeResult(15)),
					onFiltersChanged: vi.fn(),
					scheduleRender: vi.fn(),
				};

				new DashboardFilterBar(container, deps).render();

				const badge = container.querySelector(".ft-badge-muted");
				expect(badge).toBeTruthy();
				expect(badge!.textContent).toBe("~23 rows");
				resolve();
			}, 50);
		});
	});

	it("does not show row-count badge when no filters active", () => {
		const container = document.createElement("div");
		const tileResultCache = new TileResultCache();

		const deps: FilterBarDeps = {
			tiles: [makeTile("q1")],
			filters: [],
			tileResultCache,
			runQuery: vi.fn().mockResolvedValue(makeResult(100)),
			runQueryWithFilters: vi.fn(),
			onFiltersChanged: vi.fn(),
			scheduleRender: vi.fn(),
		};

		new DashboardFilterBar(container, deps).render();

		const badge = container.querySelector(".ft-badge-muted");
		expect(badge).toBeNull();
	});

	it("does not show row-count badge when cache has no results yet", () => {
		const container = document.createElement("div");
		const tileResultCache = new TileResultCache();

		const deps: FilterBarDeps = {
			tiles: [makeTile("q1")],
			filters: [{ column: "Region", values: ["US"] }],
			tileResultCache,
			runQuery: vi.fn().mockResolvedValue(makeResult(100)),
			runQueryWithFilters: vi.fn().mockResolvedValue(makeResult(15)),
			onFiltersChanged: vi.fn(),
			scheduleRender: vi.fn(),
		};

		new DashboardFilterBar(container, deps).render();

		// The badge should not appear because the cache doesn't have results yet
		// (tryRun was triggered but async hasn't resolved)
		const badges = container.querySelectorAll(".ft-badge-muted");
		// No badge with "rows" text
		const rowBadges = Array.from(badges).filter((b) => b.textContent?.includes("rows"));
		expect(rowBadges.length).toBe(0);
	});

	it("deduplicates tiles with same queryId for row count", () => {
		const container = document.createElement("div");
		const tileResultCache = new TileResultCache();

		const tiles = [makeTile("q1"), makeTile("q1")]; // same query
		const filters = [{ column: "Region", values: ["US"] }];

		const cacheKey = `q1?Region=US`;
		void tileResultCache.tryRun(cacheKey, () => Promise.resolve(makeResult(10)), () => {});

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				const deps: FilterBarDeps = {
					tiles,
					filters,
					tileResultCache,
					runQuery: vi.fn().mockResolvedValue(makeResult(100)),
					runQueryWithFilters: vi.fn().mockResolvedValue(makeResult(10)),
					onFiltersChanged: vi.fn(),
					scheduleRender: vi.fn(),
				};

				new DashboardFilterBar(container, deps).render();

				const badge = container.querySelector(".ft-badge-muted");
				expect(badge).toBeTruthy();
				// Should count q1 only once (10 rows, not 20)
				expect(badge!.textContent).toBe("~10 rows");
				resolve();
			}, 50);
		});
	});
});
