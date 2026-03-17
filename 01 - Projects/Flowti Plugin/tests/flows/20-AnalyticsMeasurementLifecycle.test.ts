/**
 * Flow 20: Analytics Measurement Lifecycle
 *
 * Create measurement → link to tile → cross-refs → delete cascade.
 *
 * Event sequence:
 *   analytics.query.saved → analytics.measurement.created →
 *   analytics.dashboard.created → analytics.dashboard.tile.added →
 *   analytics.measurement.deleted
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/mocks/obsidian-stub";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { AnalyticsService } from "../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../src/domain/analytics/types";
import { createMockStorage, collectEvents } from "./testHelpers";

// ── Fixtures ─────────────────────────────────────────────────

const SALES_HEADERS = ["Region", "Revenue", "Cost"];
const SALES_ROWS: string[][] = [
	["EMEA", "1000", "400"],
	["APAC", "800", "350"],
	["EMEA", "1200", "500"],
	["AMER", "600", "250"],
];

// ── Test suite ───────────────────────────────────────────────

describe("Flow 20: Analytics Measurement Lifecycle", () => {
	let eventBus: IEventBus;
	let svc: AnalyticsService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<AnalyticsState>();
		svc = new AnalyticsService({ storage: mock.storage, eventBus });
		await svc.load();
		svc.setReadCsv(async (csvPath: string) => {
			if (csvPath === "data/sales.csv") {
				return { headers: SALES_HEADERS, rows: SALES_ROWS, rowCount: SALES_ROWS.length, detectedDelimiter: "," };
			}
			return null;
		});
	});

	describe("measurement CRUD", () => {
		it("creates a measurement referencing a saved query", async () => {
			const q = await svc.saveQuery(
				"Sales Query",
				[{ alias: "s", csvPath: "data/sales.csv" }],
				{ joins: [], columnTypeHints: [{ column: "Revenue", type: "number" }], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "total_rev" }] },
			);

			const m = await svc.createMeasurement("Total Revenue", q.id, "single", "total_rev");
			expect(m).toBeDefined();
			expect(m.name).toBe("Total Revenue");
			expect(m.queryId).toBe(q.id);
			expect(m.type).toBe("single");
			expect(m.measureColumn).toBe("total_rev");
		});

		it("lists and retrieves measurements", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});

			await svc.createMeasurement("M1", q.id, "single", "rev");
			await svc.createMeasurement("M2", q.id, "series", "rev");
			expect(svc.listMeasurements()).toHaveLength(2);
		});

		it("deletes a measurement and emits event", async () => {
			const events = collectEvents(eventBus, "*");
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const m = await svc.createMeasurement("M1", q.id, "single", "rev");

			await svc.deleteMeasurement(m.id);
			expect(svc.listMeasurements()).toHaveLength(0);
			expect(events).toContain("analytics.measurement.deleted");
		});
	});

	describe("tile linkage", () => {
		it("links measurement to dashboard tile via measurementId", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [{ column: "Revenue", type: "number" }], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const m = await svc.createMeasurement("Rev KPI", q.id, "single", "rev");
			const dashboard = await svc.createDashboard("KPI Board");
			const tile = await svc.addTile(dashboard.id, q.id, "stat-card");
			await svc.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

			const updated = svc.getDashboard(dashboard.id)!;
			expect(updated.tiles[0].measurementId).toBe(m.id);
		});

		it("clears tile measurementId when measurement is deleted", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [{ column: "Revenue", type: "number" }], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const m = await svc.createMeasurement("Rev KPI", q.id, "single", "rev");
			const dashboard = await svc.createDashboard("KPI Board");
			const tile = await svc.addTile(dashboard.id, q.id, "stat-card");
			await svc.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

			await svc.deleteMeasurement(m.id);

			const updated = svc.getDashboard(dashboard.id)!;
			expect(updated.tiles[0].measurementId).toBeUndefined();
		});
	});

	describe("cross-references", () => {
		it("getSourcePathsForDashboard resolves measurement query sources", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const m = await svc.createMeasurement("Rev KPI", q.id, "single", "rev");
			const dashboard = await svc.createDashboard("D1");
			const tile = await svc.addTile(dashboard.id, q.id, "stat-card");
			await svc.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

			const paths = svc.getSourcePathsForDashboard(dashboard.id);
			expect(paths).toContain("data/sales.csv");
		});

		it("getDashboardQueryMap includes measurement-backed tiles", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [], dimensions: [], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const dashboard = await svc.createDashboard("D1");
			await svc.addTile(dashboard.id, q.id, "table");
			await svc.addTile(dashboard.id, q.id, "stat-card");

			const queryMap = svc.getDashboardQueryMap(dashboard.id);
			const entry = queryMap.get(q.id);
			expect(entry).toBeDefined();
			expect(entry!.tileCount).toBe(2);
		});
	});

	describe("cascade deletion", () => {
		it("deleting query cascades to measurements and clears tile references", async () => {
			const q = await svc.saveQuery("Q1", [{ alias: "s", csvPath: "data/sales.csv" }], {
				joins: [], columnTypeHints: [], dimensions: [{ column: "Region" }], measures: [{ column: "Revenue", function: "SUM", label: "rev" }],
			});
			const m = await svc.createMeasurement("KPI", q.id, "single", "rev");
			const dashboard = await svc.createDashboard("D1");
			const tile = await svc.addTile(dashboard.id, q.id, "stat-card");
			await svc.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

			await svc.deleteQuery(q.id);

			expect(svc.listMeasurements()).toHaveLength(0);
			const updated = svc.getDashboard(dashboard.id)!;
			expect(updated.tiles[0].measurementId).toBeUndefined();
		});
	});
});
