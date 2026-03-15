// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTestManagementHandlers } from "../../../src/infrastructure/handlers/test-management-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/test-management/flowti-tm-dashboard";
import "../../../src/components/test-management/flowti-tm-pyramid";
import "../../../src/components/test-management/flowti-tm-coverage";
import "../../../src/components/test-management/flowti-tm-compliance";
import "../../../src/components/test-management/flowti-tm-feature-quality";
import "../../../src/components/test-management/flowti-tm-journeys";

function createMockService() {
	return {
		getJourneys: vi.fn(() => []),
		getPyramidWithTrends: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" }, flow: { count: 0, passRate: 0, trend: "stable" }, unit: { count: 0, passRate: 0, trend: "stable" } })),
		getBaseline: vi.fn(() => null),
		getPrds: vi.fn(() => []),
		getCoverage: vi.fn(() => []),
		getCompliance: vi.fn(() => []),
		setBaseline: vi.fn(),
		addComplianceTag: vi.fn(),
		removeComplianceTag: vi.fn(),
		requestReview: vi.fn(),
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

describe("registerTestManagementHandlers", () => {
	let registry: PluginHandlerRegistry;
	let service: ReturnType<typeof createMockService>;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		service = createMockService();
		eventBus = createMockEventBus();
		registerTestManagementHandlers(registry, {
			service: service as never,
			onboardingService: { shouldShowCallout: vi.fn(() => false) } as never,
			getSettings: () => ({ docsRootPath: "docs" }) as never,
			eventBus,
		});
	});

	it("registers all 8 tab handlers", () => {
		expect(registry.getTabHandler("test-mgmt:journeys")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:pyramid")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:coverage")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:compliance")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:feature-quality")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:features")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:processes")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:products")).toBeDefined();
	});

	describe("journeys handler", () => {
		it("creates flowti-tm-journeys element", () => {
			const container = document.createElement("div");
			const handler = registry.getTabHandler("test-mgmt:journeys")!;
			handler(container, { tabId: "journeys", viewId: "test", eventBus, searchText: "login" });
			const el = container.querySelector("flowti-tm-journeys");
			expect(el).not.toBeNull();
		});

		it("sets journeys property from service", () => {
			service.getJourneys.mockReturnValue([{ name: "Test" }]);
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-journeys") as unknown as { journeys: unknown[] };
			expect(el.journeys).toHaveLength(1);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus, searchText: "login" });
			const el = container.querySelector("flowti-tm-journeys") as unknown as { searchText: string };
			expect(el.searchText).toBe("login");
		});
	});

	describe("pyramid handler", () => {
		it("creates flowti-tm-pyramid element with data", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:pyramid")!(container, { tabId: "pyramid", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-pyramid");
			expect(el).not.toBeNull();
			expect(service.getPyramidWithTrends).toHaveBeenCalled();
		});
	});

	describe("coverage handler", () => {
		it("creates flowti-tm-coverage element with pre-computed entries", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:coverage")!(container, { tabId: "coverage", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-coverage");
			expect(el).not.toBeNull();
			expect(service.getPrds).toHaveBeenCalled();
			expect(service.getCoverage).toHaveBeenCalled();
		});
	});

	describe("compliance handler", () => {
		it("creates flowti-tm-compliance element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:compliance")!(container, { tabId: "compliance", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-compliance");
			expect(el).not.toBeNull();
		});
	});

	describe("feature-quality handler", () => {
		it("creates flowti-tm-feature-quality element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:feature-quality")!(container, { tabId: "feature-quality", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-feature-quality");
			expect(el).not.toBeNull();
		});
	});

	describe("dashboard handler", () => {
		it("registers a test-management:dashboard handler", () => {
			expect(registry.getTabHandler("test-management:dashboard")).toBeDefined();
		});

		it("dashboard handler creates flowti-tm-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-management:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			expect(container.querySelector("flowti-tm-dashboard")).not.toBeNull();
		});
	});

	describe("event wiring", () => {
		it("journeys handler wires open-builder with dual eventBus emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-journeys")!;
			el.dispatchEvent(new CustomEvent("open-builder", { detail: { name: "Login" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openJourneyBuilder", expect.objectContaining({ name: "Login" }));
		});

		it("pyramid handler wires set-baseline to service", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:pyramid")!(container, { tabId: "pyramid", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-pyramid")!;
			el.dispatchEvent(new CustomEvent("set-baseline", { bubbles: true }));
			expect(service.setBaseline).toHaveBeenCalled();
		});

		it("compliance handler wires add-tag to service", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:compliance")!(container, { tabId: "compliance", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-compliance")!;
			el.dispatchEvent(new CustomEvent("add-tag", { detail: { journeyName: "Login", tagId: "qms-1" }, bubbles: true }));
			expect(service.addComplianceTag).toHaveBeenCalledWith("Login", "qms-1");
		});
	});
});
