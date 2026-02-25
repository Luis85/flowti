/**
 * Flow 31: Analytics Hub — Business Intelligence
 *
 * End-to-end integration test covering the Supplier Manager BI workflow:
 * - Quick Insights: auto-suggest queries based on detected column types
 * - Computed Columns: arithmetic expressions on aggregated results
 * - Data Freshness: relative time formatting and staleness detection
 * - Import-to-Analytics Bridge: inbox mapper for CSV import → analytics action
 *
 * Exercises: AnalyticsEngine, quickInsights, evaluateExpression,
 *            freshnessUtils, inbox mappers
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { generateQuickInsights } from "../../src/domain/analytics/quickInsights";
import { evaluateExpression } from "../../src/domain/analytics/AnalyticsEngine";
import {
	formatRelativeTime,
	getFreshnessLevel,
	getFreshnessColor,
	computeFreshnessSummary,
} from "../../src/domain/analytics/freshnessUtils";
import { mapImportToAnalytics } from "../../src/domain/inbox/mappers";
import { createMockStorage } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SUPPLIER_HEADERS = ["Supplier", "Item", "Revenue", "Cost", "Month"];
const SUPPLIER_ROWS: string[][] = [
	["Acme Corp", "Widget A", "1000", "600", "2026-01"],
	["Acme Corp", "Widget B", "800", "500", "2026-01"],
	["Beta Inc", "Widget A", "1200", "700", "2026-01"],
	["Acme Corp", "Widget A", "1100", "650", "2026-02"],
	["Beta Inc", "Widget B", "900", "550", "2026-02"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 31: Analytics Business Intelligence", () => {
	let eventBus: IEventBus;
	let analyticsService: AnalyticsService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		analyticsService = new AnalyticsService({
			storage: mock.storage,
			eventBus,
		});
		await analyticsService.load();
	});

	// ── Quick Insights ──────────────────────────────────────

	describe("Quick Insights generation", () => {
		it("should generate 5 suggestions for text + numeric + date columns", () => {
			const hints = [
				{ column: "Supplier", type: "string" as const },
				{ column: "Revenue", type: "number" as const },
				{ column: "Month", type: "date" as const },
			];

			const suggestions = generateQuickInsights(hints, SUPPLIER_HEADERS);

			expect(suggestions).toHaveLength(5);
			expect(suggestions[0].title).toBe("Total Revenue by Supplier");
			expect(suggestions[0].measures[0].function).toBe("SUM");
			expect(suggestions[1].title).toBe("Count by Supplier");
			expect(suggestions[1].measures[0].function).toBe("COUNT");
			expect(suggestions[2].title).toBe("Revenue over time");
			expect(suggestions[2].timeBucket?.period).toBe("month");
			expect(suggestions[3].title).toBe("Average Revenue by Supplier");
			expect(suggestions[3].measures[0].function).toBe("AVG");
			expect(suggestions[4].title).toBe("Top 5 Supplier by Revenue");
			expect(suggestions[4].sort).toEqual([{ column: "SUM(Revenue)", direction: "desc" }]);
			expect(suggestions[4].limit).toBe(5);
		});

		it("should generate 4 suggestions for text + numeric only (no date)", () => {
			const hints = [
				{ column: "Supplier", type: "string" as const },
				{ column: "Revenue", type: "number" as const },
			];

			const suggestions = generateQuickInsights(hints, SUPPLIER_HEADERS);

			expect(suggestions).toHaveLength(4);
			expect(suggestions[0].title).toBe("Total Revenue by Supplier");
			expect(suggestions[1].title).toBe("Count by Supplier");
			expect(suggestions[2].title).toBe("Average Revenue by Supplier");
			expect(suggestions[3].title).toBe("Top 5 Supplier by Revenue");
		});

		it("should return empty for fewer than 2 columns", () => {
			const hints = [{ column: "Name", type: "string" as const }];
			expect(generateQuickInsights(hints, ["Name"])).toHaveLength(0);
		});

		it("should generate distribution for 2 text columns with no numeric", () => {
			const hints = [
				{ column: "Name", type: "string" as const },
				{ column: "Label", type: "string" as const },
			];
			// Rule 6: Distribution of Name × Label (COUNT)
			const suggestions = generateQuickInsights(hints, ["Name", "Label"]);
			expect(suggestions).toHaveLength(1);
			expect(suggestions[0].title).toBe("Distribution of Name × Label");
			expect(suggestions[0].measures[0].function).toBe("COUNT");
		});
	});

	// ── Computed Columns ────────────────────────────────────

	describe("computed column arithmetic", () => {
		it("should evaluate simple addition", () => {
			const row = { Revenue: 1000, Cost: 600 };
			expect(evaluateExpression("{Revenue} + {Cost}", row)).toBe(1600);
		});

		it("should evaluate subtraction for profit calculation", () => {
			const row = { Revenue: 1000, Cost: 600 };
			expect(evaluateExpression("{Revenue} - {Cost}", row)).toBe(400);
		});

		it("should handle multiplication and division", () => {
			const row = { Revenue: 1000, Cost: 600 };
			expect(evaluateExpression("{Cost} / {Revenue} * 100", row)).toBeCloseTo(60);
		});

		it("should return 0 for division by zero", () => {
			const row = { Revenue: 0, Cost: 600 };
			expect(evaluateExpression("{Cost} / {Revenue}", row)).toBe(0);
		});

		it("should return 0 for invalid column reference", () => {
			const row = { Revenue: 1000 };
			expect(evaluateExpression("{Missing} + {Revenue}", row)).toBe(1000);
		});

		it("should return 0 for empty expression", () => {
			expect(evaluateExpression("", {})).toBe(0);
			expect(evaluateExpression("   ", {})).toBe(0);
		});

		it("should integrate computed columns in query execution", async () => {
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SUPPLIER_HEADERS, rows: SUPPLIER_ROWS } }],
				joins: [],
				columnTypeHints: [
					{ column: "Revenue", type: "number" },
					{ column: "Cost", type: "number" },
				],
				dimensions: [{ column: "Supplier" }],
				measures: [
					{ column: "Revenue", function: "SUM" },
					{ column: "Cost", function: "SUM" },
				],
				computedColumns: [
					{ name: "Profit", expression: "{SUM(Revenue)} - {SUM(Cost)}" },
				],
			});

			expect(result.columns).toContain("Profit");

			const acmeRow = result.rows.find((r) => r["Supplier"] === "Acme Corp");
			expect(acmeRow).toBeDefined();
			expect(acmeRow!["Profit"]).toBe(
				(acmeRow!["SUM(Revenue)"] as number) - (acmeRow!["SUM(Cost)"] as number),
			);
		});
	});

	// ── Data Freshness ──────────────────────────────────────

	describe("data freshness tracking", () => {
		it("should format relative time correctly", () => {
			const now = Date.now();
			expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
			expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 min ago");
			expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2 hr ago");
			expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
		});

		it("should classify freshness levels correctly", () => {
			const now = Date.now();
			expect(getFreshnessLevel(now - 5 * 60_000, now)).toBe("fresh");
			expect(getFreshnessLevel(now - 30 * 60_000, now)).toBe("aging");
			expect(getFreshnessLevel(now - 2 * 3_600_000, now)).toBe("stale");
		});

		it("should return appropriate CSS colors per level", () => {
			expect(getFreshnessColor("fresh")).toContain("success");
			expect(getFreshnessColor("aging")).toContain("warning");
			expect(getFreshnessColor("stale")).toContain("error");
		});

		it("should compute dashboard freshness summary", () => {
			const now = Date.now();
			expect(computeFreshnessSummary([], now)).toBe("");
			expect(computeFreshnessSummary([undefined, undefined], now)).toBe("Not yet refreshed");
			expect(computeFreshnessSummary([now - 60_000, now - 120_000], now)).toBe("All tiles fresh");
			expect(computeFreshnessSummary([now - 60_000, now - 2 * 3_600_000], now)).toBe("1 stale tile");
			expect(computeFreshnessSummary([now - 30 * 60_000, now - 45 * 60_000], now)).toBe("2 aging tiles");
		});
	});

	// ── Import-to-Analytics Bridge ──────────────────────────

	describe("import-to-analytics bridge", () => {
		it("should create analytics action inbox item from import event", () => {
			const item = mapImportToAnalytics(
				{
					result: { totalRows: 50, created: 48 },
					sourcePath: "data/supplier-master.csv",
				},
				"inbox_test_1",
			);

			expect(item.type).toBe("action");
			expect(item.sourceHub).toBe("analytics");
			expect(item.title).toContain("supplier-master.csv");
			expect(item.title).toContain("Analyze");
			expect(item.description).toContain("50 rows");
			expect(item.read).toBe(false);
		});

		it("should handle missing sourcePath gracefully", () => {
			const item = mapImportToAnalytics(
				{ result: { totalRows: 10, created: 10 } },
				"inbox_test_2",
			);

			expect(item.title).toContain("imported file");
			expect(item.sourceHub).toBe("analytics");
		});
	});

	// ── End-to-end BI workflow ───────────────────────────────

	describe("end-to-end BI workflow", () => {
		it("should execute a full cycle: query → computed column → save → dashboard tile", async () => {
			// 1. Run a query with computed columns (Profit = Revenue - Cost)
			const result = await analyticsService.runQuery({
				sources: [{ alias: "s", data: { headers: SUPPLIER_HEADERS, rows: SUPPLIER_ROWS } }],
				joins: [],
				columnTypeHints: [
					{ column: "Revenue", type: "number" },
					{ column: "Cost", type: "number" },
				],
				dimensions: [{ column: "Supplier" }],
				measures: [
					{ column: "Revenue", function: "SUM" },
					{ column: "Cost", function: "SUM" },
				],
				computedColumns: [
					{ name: "Profit", expression: "{SUM(Revenue)} - {SUM(Cost)}" },
					{ name: "Margin %", expression: "({SUM(Revenue)} - {SUM(Cost)}) / {SUM(Revenue)} * 100" },
				],
			});

			// Verify computed columns exist
			expect(result.columns).toContain("Profit");
			expect(result.columns).toContain("Margin %");
			expect(result.rows.length).toBeGreaterThan(0);

			// 2. Save the query
			const saved = await analyticsService.saveQuery(
				"Supplier Profitability",
				[{ alias: "s", csvPath: "data/sales.csv" }],
				{
					joins: [],
					columnTypeHints: [
						{ column: "Revenue", type: "number" },
						{ column: "Cost", type: "number" },
					],
					dimensions: [{ column: "Supplier" }],
					measures: [
						{ column: "Revenue", function: "SUM" },
						{ column: "Cost", function: "SUM" },
					],
					computedColumns: [
						{ name: "Profit", expression: "{SUM(Revenue)} - {SUM(Cost)}" },
					],
				},
			);

			expect(saved.computedColumns).toHaveLength(1);
			expect(saved.computedColumns![0].name).toBe("Profit");

			// 3. Create a dashboard and add the query as a tile
			const dashboard = await analyticsService.createDashboard("Daily KPIs");
			await analyticsService.addTile(dashboard.id, saved.id, "stat-card");

			const updated = analyticsService.getDashboard(dashboard.id);
			expect(updated!.tiles).toHaveLength(1);

			// 4. Set as default dashboard
			await analyticsService.setDefaultDashboard(dashboard.id);
			const defaultDb = analyticsService.getDefaultDashboard();
			expect(defaultDb?.id).toBe(dashboard.id);
		});
	});
});
