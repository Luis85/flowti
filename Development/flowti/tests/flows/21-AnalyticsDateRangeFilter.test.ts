/**
 * Flow 21: Analytics Date Range Filter
 *
 * Add date source → set date range → verify filtered aggregation →
 * change preset → verify update → compose with dimension filter.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState, QueryDateRangeFilter } from "../../src/domain/analytics/types";
import { resolveDateRangeFilter } from "../../src/domain/analytics/dateUtils";
import { createMockStorage } from "./testHelpers";

// ── Fixtures — deterministic date-based data ─────────────────

const HEADERS = ["date", "region", "revenue"];
const ROWS: string[][] = [
	["2026-01-05", "EMEA", "100"],
	["2026-01-15", "APAC", "200"],
	["2026-02-10", "EMEA", "300"],
	["2026-02-20", "APAC", "400"],
	["2026-03-05", "EMEA", "500"],
	["2026-03-15", "AMER", "600"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 21: Analytics Date Range Filter", () => {
	let eventBus: IEventBus;
	let svc: AnalyticsService;
	let queryId: string;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		svc = new AnalyticsService({ storage: mock.storage, eventBus });
		await svc.load();
		svc.setReadCsv(async (csvPath: string) => {
			if (csvPath === "data/sales.csv") {
				return { headers: HEADERS, rows: ROWS, rowCount: ROWS.length, detectedDelimiter: "," };
			}
			return null;
		});

		const saved = await svc.saveQuery(
			"Sales by Region",
			[{ alias: "s", csvPath: "data/sales.csv" }],
			{
				joins: [],
				columnTypeHints: [
					{ column: "date", type: "date" },
					{ column: "revenue", type: "number" },
				],
				dimensions: [{ column: "region" }],
				measures: [{ column: "revenue", function: "SUM", label: "total_rev" }],
			},
		);
		queryId = saved.id;
	});

	describe("full result (no date filter)", () => {
		it("returns all rows grouped by region", async () => {
			const result = await svc.runSavedQuery(queryId);
			expect(result.rows).toHaveLength(3); // EMEA, APAC, AMER
			const total = result.rows.reduce((sum, r) => sum + (r.total_rev as number), 0);
			expect(total).toBe(2100); // 100+200+300+400+500+600
		});
	});

	describe("date range pre-filter", () => {
		it("filters rows within January 2026 only", async () => {
			const dateRange: QueryDateRangeFilter = {
				column: "date",
				start: { year: 2026, month: 1, day: 1 },
				end: { year: 2026, month: 1, day: 31 },
			};

			svc.clearQueryCache();
			const result = await svc.runSavedQueryWithFilters(queryId, [], dateRange);
			// Jan rows: EMEA=100, APAC=200 → 2 regions
			expect(result.rows).toHaveLength(2);
			const total = result.rows.reduce((sum, r) => sum + (r.total_rev as number), 0);
			expect(total).toBe(300);
		});

		it("filters rows within February 2026", async () => {
			const dateRange: QueryDateRangeFilter = {
				column: "date",
				start: { year: 2026, month: 2, day: 1 },
				end: { year: 2026, month: 2, day: 28 },
			};

			svc.clearQueryCache();
			const result = await svc.runSavedQueryWithFilters(queryId, [], dateRange);
			// Feb rows: EMEA=300, APAC=400 → 2 regions
			expect(result.rows).toHaveLength(2);
			const total = result.rows.reduce((sum, r) => sum + (r.total_rev as number), 0);
			expect(total).toBe(700);
		});

		it("returns empty result for out-of-range dates", async () => {
			const dateRange: QueryDateRangeFilter = {
				column: "date",
				start: { year: 2025, month: 1, day: 1 },
				end: { year: 2025, month: 12, day: 31 },
			};

			svc.clearQueryCache();
			const result = await svc.runSavedQueryWithFilters(queryId, [], dateRange);
			expect(result.rows).toHaveLength(0);
		});
	});

	describe("composition with dimension filters", () => {
		it("applies date range AND dimension filter together", async () => {
			const dateRange: QueryDateRangeFilter = {
				column: "date",
				start: { year: 2026, month: 1, day: 1 },
				end: { year: 2026, month: 2, day: 28 },
			};
			const dimFilters = [{ column: "region", values: ["EMEA"] }];

			svc.clearQueryCache();
			const result = await svc.runSavedQueryWithFilters(queryId, dimFilters, dateRange);
			// Jan+Feb EMEA rows: 100 + 300 = 400
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0].total_rev).toBe(400);
			expect(result.rows[0].region).toBe("EMEA");
		});

		it("dimension filter alone works as post-filter", async () => {
			svc.clearQueryCache();
			const result = await svc.runSavedQueryWithFilters(queryId, [{ column: "region", values: ["AMER"] }]);
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0].total_rev).toBe(600);
		});
	});

	describe("resolveDateRangeFilter", () => {
		it("auto-detects date column from type hints", () => {
			const resolved = resolveDateRangeFilter(
				{ preset: "this-year", column: "" },
				[{ column: "date", type: "date" }, { column: "revenue", type: "number" }],
			);
			expect(resolved).not.toBeNull();
			expect(resolved!.column).toBe("date");
		});

		it("returns null when no date column found", () => {
			const resolved = resolveDateRangeFilter(
				{ preset: "this-year", column: "" },
				[{ column: "revenue", type: "number" }],
			);
			expect(resolved).toBeNull();
		});

		it("resolves custom range with explicit dates", () => {
			const resolved = resolveDateRangeFilter(
				{ preset: "custom", column: "date", startDate: "2026-01-01", endDate: "2026-01-31" },
				[{ column: "date", type: "date" }],
			);
			expect(resolved).not.toBeNull();
			expect(resolved!.start).toEqual({ year: 2026, month: 1, day: 1 });
			expect(resolved!.end).toEqual({ year: 2026, month: 1, day: 31 });
		});
	});
});
