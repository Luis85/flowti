import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardCallbackFactory, type DashboardCallbackFactoryDeps } from "../../../src/ui/analytics/DashboardCallbackFactory";
import type { DashboardTile } from "../../../src/domain/analytics/types";

function createMockDeps(): DashboardCallbackFactoryDeps {
	return {
		analyticsService: {
			removeTile: vi.fn().mockResolvedValue(undefined),
			reorderTile: vi.fn().mockResolvedValue(undefined),
			updateTile: vi.fn().mockResolvedValue(undefined),
		} as unknown as DashboardCallbackFactoryDeps["analyticsService"],
		tileResultCache: {
			clearOne: vi.fn(),
			clearByQueryId: vi.fn(),
			clear: vi.fn(),
		} as unknown as DashboardCallbackFactoryDeps["tileResultCache"],
		getState: vi.fn().mockReturnValue({ crossTileFilter: null }),
		setState: vi.fn(),
		navigation: { navigateTo: vi.fn(), navigateToTab: vi.fn() },
		scheduleRender: vi.fn(),
	};
}

function createMockTile(overrides: Partial<DashboardTile> = {}): DashboardTile {
	return {
		id: "tile-1",
		queryId: "query-1",
		displayMode: "table",
		width: 3,
		height: 2,
		title: "Test Tile",
		tiles: [],
		...overrides,
	} as DashboardTile;
}

describe("DashboardCallbackFactory", () => {
	let deps: DashboardCallbackFactoryDeps;
	let factory: DashboardCallbackFactory;

	beforeEach(() => {
		deps = createMockDeps();
		factory = new DashboardCallbackFactory(deps);
	});

	describe("createTileCallbacks", () => {
		it("creates all expected callback properties", () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			expect(callbacks).toHaveProperty("onRemove");
			expect(callbacks).toHaveProperty("onRefresh");
			expect(callbacks).toHaveProperty("onReorder");
			expect(callbacks).toHaveProperty("onTitleChange");
			expect(callbacks).toHaveProperty("onDisplayModeToggle");
			expect(callbacks).toHaveProperty("onRulesChange");
			expect(callbacks).toHaveProperty("onNumberFormatChange");
			expect(callbacks).toHaveProperty("onChartValueColumnChange");
			expect(callbacks).toHaveProperty("onChartValueColumnsChange");
			expect(callbacks).toHaveProperty("onHiddenSeriesChange");
			expect(callbacks).toHaveProperty("onQueryChange");
			expect(callbacks).toHaveProperty("onMeasurementChange");
			expect(callbacks).toHaveProperty("onWidthChange");
			expect(callbacks).toHaveProperty("onHeightChange");
			expect(callbacks).toHaveProperty("onSparklineToggle");
			expect(callbacks).toHaveProperty("onRowLimitChange");
			expect(callbacks).toHaveProperty("onAutoHeightToggle");
			expect(callbacks).toHaveProperty("onExcludedColumnsChange");
			expect(callbacks).toHaveProperty("onTableKpisToggle");
			expect(callbacks).toHaveProperty("onTableKpiLabelChange");
			expect(callbacks).toHaveProperty("onColumnOrderChange");
			expect(callbacks).toHaveProperty("onViewQuery");
			expect(callbacks).toHaveProperty("onCrossTileFilter");
		});
	});

	describe("onRemove", () => {
		it("calls removeTile and schedules render", async () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onRemove("tile-1");
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.removeTile).toHaveBeenCalledWith("dash-1", "tile-1");
		});
	});

	describe("onRefresh — cache invalidation: clearByQueryId", () => {
		it("clears cache by effective queryId and schedules render", () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "eff-query-1", []);

			callbacks.onRefresh();

			expect(deps.tileResultCache.clearByQueryId).toHaveBeenCalledWith("eff-query-1");
			expect(deps.scheduleRender).toHaveBeenCalled();
		});
	});

	describe("onDisplayModeToggle — cache invalidation: clearOne(tile.queryId)", () => {
		it("updates tile and clears cache for tile's original queryId", async () => {
			const tile = createMockTile({ queryId: "original-query" });
			const callbacks = factory.createTileCallbacks("dash-1", tile, "eff-query-1", []);

			callbacks.onDisplayModeToggle("tile-1", "stat-card");
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.updateTile).toHaveBeenCalledWith("dash-1", "tile-1", { displayMode: "stat-card" });
			expect(deps.tileResultCache.clearOne).toHaveBeenCalledWith("original-query");
		});
	});

	describe("onQueryChange — cache invalidation: clearOne(newQueryId)", () => {
		it("updates tile and clears cache for the new queryId", async () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onQueryChange("tile-1", "new-query-99");
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.updateTile).toHaveBeenCalledWith("dash-1", "tile-1", { queryId: "new-query-99" });
			expect(deps.tileResultCache.clearOne).toHaveBeenCalledWith("new-query-99");
		});
	});

	describe("onMeasurementChange — cache invalidation: clear()", () => {
		it("updates tile and clears entire cache", async () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onMeasurementChange("tile-1", "meas-42");
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.updateTile).toHaveBeenCalledWith("dash-1", "tile-1", { measurementId: "meas-42" });
			expect(deps.tileResultCache.clear).toHaveBeenCalled();
		});
	});

	describe("property update callbacks — no cache invalidation", () => {
		it("onTitleChange updates title without cache action", async () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onTitleChange("tile-1", "New Title");
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.updateTile).toHaveBeenCalledWith("dash-1", "tile-1", { title: "New Title" });
			expect(deps.tileResultCache.clearOne).not.toHaveBeenCalled();
			expect(deps.tileResultCache.clearByQueryId).not.toHaveBeenCalled();
			expect(deps.tileResultCache.clear).not.toHaveBeenCalled();
		});

		it("onWidthChange updates width without cache action", async () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onWidthChange("tile-1", 4);
			await vi.waitFor(() => expect(deps.scheduleRender).toHaveBeenCalled());

			expect(deps.analyticsService.updateTile).toHaveBeenCalledWith("dash-1", "tile-1", { width: 4 });
		});
	});

	describe("onViewQuery — navigation", () => {
		it("sets selected query and navigates to queries tab", () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onViewQuery("query-42");

			expect(deps.setState).toHaveBeenCalledWith({ selectedQueryId: "query-42" });
			expect(deps.navigation.navigateTo).toHaveBeenCalledWith("queries");
			expect(deps.scheduleRender).toHaveBeenCalled();
		});
	});

	describe("onCrossTileFilter", () => {
		it("sets new cross-tile filter and clears cache", () => {
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onCrossTileFilter("tile-1", "status", "active");

			expect(deps.setState).toHaveBeenCalledWith({
				crossTileFilter: { sourceTileId: "tile-1", column: "status", value: "active" },
			});
			expect(deps.tileResultCache.clear).toHaveBeenCalled();
			expect(deps.scheduleRender).toHaveBeenCalled();
		});

		it("toggles off when same tile+column+value is applied", () => {
			(deps.getState as ReturnType<typeof vi.fn>).mockReturnValue({
				crossTileFilter: { sourceTileId: "tile-1", column: "status", value: "active" },
			});
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", []);

			callbacks.onCrossTileFilter("tile-1", "status", "active");

			expect(deps.setState).toHaveBeenCalledWith({ crossTileFilter: null });
		});

		it("calls breadcrumb update callback when provided", () => {
			const onBreadcrumbUpdate = vi.fn();
			const tile = createMockTile();
			const callbacks = factory.createTileCallbacks("dash-1", tile, "query-1", [], onBreadcrumbUpdate);

			callbacks.onCrossTileFilter("tile-1", "status", "active");

			expect(onBreadcrumbUpdate).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ column: "status", values: ["active"] }),
				]),
				"dash-1",
			);
		});
	});
});
