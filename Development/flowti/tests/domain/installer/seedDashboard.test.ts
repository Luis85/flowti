import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "../../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../../src/domain/analytics/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { seedSupplierDashboard } from "../../../src/domain/installer/seedDashboard";
import { SEED_CSV_PATH } from "../../../src/domain/installer/seedData";

// ── Helpers ──────────────────────────────────────────────

function createMockStorage(): ITypedStorage<AnalyticsState> {
	let data: AnalyticsState = {
		savedAnalyticsQueries: [],
		dashboards: [],
	};
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: AnalyticsState) => {
			data = state;
		}),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: AnalyticsState) => {
			data = state;
			return true;
		}),
	} as unknown as ITypedStorage<AnalyticsState>;
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	} as unknown as IEventBus;
}

async function buildService(): Promise<AnalyticsService> {
	const service = new AnalyticsService({
		storage: createMockStorage(),
		eventBus: createMockEventBus(),
	});
	await service.load();
	return service;
}

// ── Tests ────────────────────────────────────────────────

describe("seedSupplierDashboard", () => {
	let service: AnalyticsService;

	beforeEach(async () => {
		service = await buildService();
	});

	it("should create a dashboard named 'Supplier Overview'", async () => {
		await seedSupplierDashboard(service);

		const dashboards = service.listDashboards();
		expect(dashboards).toHaveLength(1);
		expect(dashboards[0].name).toBe("Supplier Overview");
	});

	it("should create a dashboard with a description", async () => {
		await seedSupplierDashboard(service);

		const dashboard = service.listDashboards()[0];
		expect(dashboard.description).toBeDefined();
		expect(dashboard.description!.length).toBeGreaterThan(0);
	});

	it("should create 2 saved queries", async () => {
		await seedSupplierDashboard(service);

		const queries = service.listQueries();
		expect(queries).toHaveLength(2);

		const names = queries.map((q) => q.name);
		expect(names).toContain("Supplier Overview - By Supplier");
		expect(names).toContain("Supplier Trend - Monthly Spend");
	});

	it("should reference the seed CSV path in both queries", async () => {
		await seedSupplierDashboard(service);

		const queries = service.listQueries();
		for (const q of queries) {
			expect(q.sources).toHaveLength(1);
			expect(q.sources[0].csvPath).toBe(SEED_CSV_PATH);
		}
	});

	it("should add 5 tiles to the dashboard", async () => {
		await seedSupplierDashboard(service);

		const dashboard = service.listDashboards()[0];
		expect(dashboard.tiles).toHaveLength(5);
	});

	it("should create 3 stat cards in row 0", async () => {
		await seedSupplierDashboard(service);

		const tiles = service.listDashboards()[0].tiles;
		const statCards = tiles.filter((t) => t.displayMode === "stat-card");
		expect(statCards).toHaveLength(3);

		for (const card of statCards) {
			expect(card.row).toBe(0);
			expect(card.width).toBe(1);
		}

		const cols = statCards.map((c) => c.col).sort();
		expect(cols).toEqual([0, 1, 2]);
	});

	it("should set currency format on Total Spend stat card", async () => {
		await seedSupplierDashboard(service);

		const tiles = service.listDashboards()[0].tiles;
		const spendCard = tiles.find((t) => t.title === "Total Spend");
		expect(spendCard).toBeDefined();
		expect(spendCard!.numberFormat).toEqual({
			style: "currency",
			symbol: "$",
			decimals: 0,
		});
	});

	it("should create a bar chart in row 1 with width 3", async () => {
		await seedSupplierDashboard(service);

		const tiles = service.listDashboards()[0].tiles;
		const chart = tiles.find((t) => t.displayMode === "bar-chart");
		expect(chart).toBeDefined();
		expect(chart!.row).toBe(1);
		expect(chart!.col).toBe(0);
		expect(chart!.width).toBe(3);
		expect(chart!.chartValueColumn).toBe("Monthly Spend");
	});

	it("should create a table in row 2 with KPI settings", async () => {
		await seedSupplierDashboard(service);

		const tiles = service.listDashboards()[0].tiles;
		const table = tiles.find((t) => t.displayMode === "table");
		expect(table).toBeDefined();
		expect(table!.row).toBe(2);
		expect(table!.col).toBe(0);
		expect(table!.width).toBe(3);
		expect(table!.showTableKpis).toBe(true);
		expect(table!.tableKpiLabel).toBe("Suppliers");
	});

	it("should set the dashboard as default", async () => {
		await seedSupplierDashboard(service);

		const defaultDashboard = service.getDefaultDashboard();
		expect(defaultDashboard).toBeDefined();
		expect(defaultDashboard!.name).toBe("Supplier Overview");
	});

	it("should be idempotent — skip if dashboard already exists", async () => {
		await seedSupplierDashboard(service);
		await seedSupplierDashboard(service);

		expect(service.listDashboards()).toHaveLength(1);
		expect(service.listQueries()).toHaveLength(2);
	});
});
