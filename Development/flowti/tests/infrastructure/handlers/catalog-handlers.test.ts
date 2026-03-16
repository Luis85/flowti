// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCatalogHandlers } from "../../../src/infrastructure/handlers/catalog-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/catalog/flowti-entity-scanner";
import "../../../src/components/catalog/flowti-catalog-events";

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

function createMockViewState() {
	return {
		getDiscoveredEvents: vi.fn(() => []),
		getExcludedTypes: vi.fn(() => []),
		getNotifiedTypes: vi.fn(() => []),
		getDomainEntries: vi.fn(() => []),
		getServiceEntries: vi.fn(() => []),
		getFlowEntries: vi.fn(() => []),
		getSystemEntries: vi.fn(() => []),
		getActorEntries: vi.fn(() => []),
		getCategories: vi.fn(() => []),
	};
}

describe("registerCatalogHandlers", () => {
	let registry: PluginHandlerRegistry;
	let eventBus: IEventBus;
	let viewState: ReturnType<typeof createMockViewState>;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		eventBus = createMockEventBus();
		viewState = createMockViewState();
		registerCatalogHandlers(registry, { viewState, eventBus });
	});

	it("registers all 6 tab handlers", () => {
		expect(registry.getTabHandler("catalog:events")).toBeDefined();
		expect(registry.getTabHandler("catalog:domains")).toBeDefined();
		expect(registry.getTabHandler("catalog:services")).toBeDefined();
		expect(registry.getTabHandler("catalog:flows")).toBeDefined();
		expect(registry.getTabHandler("catalog:systems")).toBeDefined();
		expect(registry.getTabHandler("catalog:actors")).toBeDefined();
	});

	describe("events handler", () => {
		it("creates flowti-catalog-events element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:events")!(container, {
				tabId: "events",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-catalog-events");
			expect(el).not.toBeNull();
		});

		it("sets events property from viewState", () => {
			const events = [
				{ type: "user.created", description: "Created", category: "User", domain: "auth", services: "AuthService", isExcluded: false, isNotified: false },
			];
			viewState.getDiscoveredEvents.mockReturnValue(events);
			const container = document.createElement("div");
			registry.getTabHandler("catalog:events")!(container, {
				tabId: "events",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-catalog-events") as unknown as { events: unknown[] };
			expect(el.events).toEqual(events);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:events")!(container, {
				tabId: "events",
				viewId: "flowti-event-catalog",
				eventBus,
				searchText: "user",
			});
			const el = container.querySelector("flowti-catalog-events") as unknown as { searchText: string };
			expect(el.searchText).toBe("user");
		});

		it("passes excludedTypes from viewState", () => {
			viewState.getExcludedTypes.mockReturnValue(["user.created"]);
			const container = document.createElement("div");
			registry.getTabHandler("catalog:events")!(container, {
				tabId: "events",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-catalog-events") as unknown as { excludedTypes: Set<string> };
			expect(el.excludedTypes).toEqual(new Set(["user.created"]));
		});

		it("passes notifiedTypes from viewState", () => {
			viewState.getNotifiedTypes.mockReturnValue(["user.created"]);
			const container = document.createElement("div");
			registry.getTabHandler("catalog:events")!(container, {
				tabId: "events",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-catalog-events") as unknown as { notifiedTypes: Set<string> };
			expect(el.notifiedTypes).toEqual(new Set(["user.created"]));
		});
	});

	describe("domains handler", () => {
		it("creates flowti-entity-scanner element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:domains")!(container, {
				tabId: "domains",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner");
			expect(el).not.toBeNull();
		});

		it("sets entityType to domains", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:domains")!(container, {
				tabId: "domains",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entityType: string };
			expect(el.entityType).toBe("domains");
		});

		it("sets entities from viewState", () => {
			const domains = [{ id: "auth", name: "Auth", description: "Auth domain", count: 5 }];
			viewState.getDomainEntries.mockReturnValue(domains);
			const container = document.createElement("div");
			registry.getTabHandler("catalog:domains")!(container, {
				tabId: "domains",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entities: unknown[] };
			expect(el.entities).toEqual(domains);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:domains")!(container, {
				tabId: "domains",
				viewId: "flowti-event-catalog",
				eventBus,
				searchText: "auth",
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { searchText: string };
			expect(el.searchText).toBe("auth");
		});
	});

	describe("services handler", () => {
		it("creates flowti-entity-scanner with entityType services", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:services")!(container, {
				tabId: "services",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entityType: string };
			expect(el).not.toBeNull();
			expect(el.entityType).toBe("services");
		});
	});

	describe("flows handler", () => {
		it("creates flowti-entity-scanner with entityType flows", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:flows")!(container, {
				tabId: "flows",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entityType: string };
			expect(el).not.toBeNull();
			expect(el.entityType).toBe("flows");
		});
	});

	describe("systems handler", () => {
		it("creates flowti-entity-scanner with entityType systems", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:systems")!(container, {
				tabId: "systems",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entityType: string };
			expect(el).not.toBeNull();
			expect(el.entityType).toBe("systems");
		});
	});

	describe("actors handler", () => {
		it("creates flowti-entity-scanner with entityType actors", () => {
			const container = document.createElement("div");
			registry.getTabHandler("catalog:actors")!(container, {
				tabId: "actors",
				viewId: "flowti-event-catalog",
				eventBus,
			});
			const el = container.querySelector("flowti-entity-scanner") as unknown as { entityType: string };
			expect(el).not.toBeNull();
			expect(el.entityType).toBe("actors");
		});
	});
});
