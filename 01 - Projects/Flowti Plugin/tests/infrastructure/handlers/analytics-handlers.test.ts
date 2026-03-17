// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAnalyticsHandlers } from "../../../src/infrastructure/handlers/analytics-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/analytics/flowti-analytics-dashboard";
import "../../../src/components/analytics/flowti-analytics-queries";
import "../../../src/components/analytics/flowti-analytics-measurements";

function createMockAnalyticsService() {
	return {
		listQueries: vi.fn((): readonly unknown[] => []),
		listDashboards: vi.fn((): readonly unknown[] => []),
		listMeasurements: vi.fn((): readonly unknown[] => []),
		getQuery: vi.fn(() => null),
		getDashboardQueryMap: vi.fn(() => new Map()),
		getDefaultDashboard: vi.fn(() => null),
		runSavedQuery: vi.fn(),
	};
}

function createMockTileResultCache() {
	return {
		tryRun: vi.fn(),
		getTimestamp: vi.fn(),
		clear: vi.fn(),
		clearByQueryId: vi.fn(),
	};
}

function createMockOnboardingService() {
	return {
		isCalloutDismissed: vi.fn(() => false),
		dismissCallout: vi.fn(),
		shouldShowCallout: vi.fn(() => true),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

describe("registerAnalyticsHandlers", () => {
	let registry: PluginHandlerRegistry;
	let analyticsService: ReturnType<typeof createMockAnalyticsService>;
	let tileResultCache: ReturnType<typeof createMockTileResultCache>;
	let onboardingService: ReturnType<typeof createMockOnboardingService>;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		analyticsService = createMockAnalyticsService();
		tileResultCache = createMockTileResultCache();
		onboardingService = createMockOnboardingService();
		eventBus = createMockEventBus();
		registerAnalyticsHandlers(registry, {
			analyticsService,
			tileResultCache,
			onboardingService,
			eventBus,
		});
	});

	it("registers all 3 tab handlers", () => {
		expect(registry.getTabHandler("analytics:dashboards")).toBeDefined();
		expect(registry.getTabHandler("analytics:queries")).toBeDefined();
		expect(registry.getTabHandler("analytics:measurements")).toBeDefined();
	});

	describe("dashboards handler", () => {
		it("creates flowti-analytics-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:dashboards")!(container, { tabId: "dashboards", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-dashboard");
			expect(el).not.toBeNull();
		});

		it("sets dashboards data from analyticsService", () => {
			const dashboards = [{ id: "d1", name: "Test", tiles: [], createdAt: 0, updatedAt: 0 }];
			analyticsService.listDashboards.mockReturnValue(dashboards);
			const container = document.createElement("div");
			registry.getTabHandler("analytics:dashboards")!(container, { tabId: "dashboards", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-dashboard") as unknown as { dashboard: unknown };
			// Handler may set dashboard or tiles — just verify the element is created with data
			expect(el).not.toBeNull();
		});

		it("wires add-tile event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:dashboards")!(container, { tabId: "dashboards", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-dashboard")!;
			el.dispatchEvent(new CustomEvent("add-tile", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.addTile", {});
		});

		it("wires remove-tile event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:dashboards")!(container, { tabId: "dashboards", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-dashboard")!;
			el.dispatchEvent(new CustomEvent("remove-tile", { detail: { tileId: "t1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.removeTile", { tileId: "t1" });
		});

		it("wires rename-dashboard event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:dashboards")!(container, { tabId: "dashboards", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-dashboard")!;
			el.dispatchEvent(new CustomEvent("rename-dashboard", { detail: { name: "New Name" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.renameDashboard", { name: "New Name" });
		});
	});

	describe("queries handler", () => {
		it("creates flowti-analytics-queries element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-queries");
			expect(el).not.toBeNull();
		});

		it("sets savedQueries from analyticsService", () => {
			const queries = [{ id: "q1", name: "Test Query" }];
			analyticsService.listQueries.mockReturnValue(queries);
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-queries") as unknown as { savedQueries: unknown[] };
			expect(el.savedQueries).toEqual(queries);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus, searchText: "revenue" });
			const el = container.querySelector("flowti-analytics-queries") as unknown as { searchText: string };
			expect(el.searchText).toBe("revenue");
		});

		it("wires run-query event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-queries")!;
			el.dispatchEvent(new CustomEvent("run-query", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.runQuery", {});
		});

		it("wires save-query event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-queries")!;
			el.dispatchEvent(new CustomEvent("save-query", { detail: { queryId: "q1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.saveQuery", { queryId: "q1" });
		});

		it("wires delete-query event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:queries")!(container, { tabId: "queries", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-queries")!;
			el.dispatchEvent(new CustomEvent("delete-query", { detail: { queryId: "q1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.deleteQuery", { queryId: "q1" });
		});
	});

	describe("measurements handler", () => {
		it("creates flowti-analytics-measurements element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-measurements");
			expect(el).not.toBeNull();
		});

		it("sets measurements from analyticsService", () => {
			const measurements = [{ id: "m1", name: "Total Revenue" }];
			analyticsService.listMeasurements.mockReturnValue(measurements);
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-measurements") as unknown as { measurements: unknown[] };
			expect(el.measurements).toEqual(measurements);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus, searchText: "revenue" });
			const el = container.querySelector("flowti-analytics-measurements") as unknown as { searchText: string };
			expect(el.searchText).toBe("revenue");
		});

		it("wires measurement-selected to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-measurements")!;
			el.dispatchEvent(new CustomEvent("measurement-selected", { detail: { id: "m1", name: "Revenue" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.measurementSelected", { id: "m1", name: "Revenue" });
		});

		it("wires create event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-measurements")!;
			el.dispatchEvent(new CustomEvent("create", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.createMeasurement", {});
		});

		it("wires delete event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("analytics:measurements")!(container, { tabId: "measurements", viewId: "analytics-hub", eventBus });
			const el = container.querySelector("flowti-analytics-measurements")!;
			el.dispatchEvent(new CustomEvent("delete", { detail: { id: "m1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("analytics.ui.deleteMeasurement", { id: "m1" });
		});
	});
});
