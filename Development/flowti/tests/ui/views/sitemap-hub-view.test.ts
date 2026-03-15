// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { SitemapHubView } from "../../../src/ui/views/sitemap-hub-view";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { ViewDef } from "../../../src/domain/sitemap/plugin-sitemap-types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { WorkspaceLeaf } from "obsidian";

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

function createViewDef(overrides?: Partial<ViewDef>): ViewDef {
	return {
		kind: "hub",
		label: "Test Hub",
		icon: "home",
		type: "flowti-test-hub",
		tabs: [
			{ id: "tab1", label: "Tab One", icon: "star", handler: "test:tab1" },
			{ id: "tab2", label: "Tab Two", icon: "zap", component: "flowti-widget", dataSource: "test:data" },
		],
		...overrides,
	};
}

describe("SitemapHubView", () => {
	let leaf: WorkspaceLeaf;
	let eventBus: IEventBus;
	let registry: PluginHandlerRegistry;

	beforeEach(() => {
		leaf = new WorkspaceLeaf();
		eventBus = createMockEventBus();
		registry = new PluginHandlerRegistry();
	});

	describe("view metadata", () => {
		it("returns view type from ViewDef", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getViewType()).toBe("flowti-test-hub");
		});

		it("returns display text from ViewDef label", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ label: "My Hub" }), registry);
			expect(view.getDisplayText()).toBe("My Hub");
		});

		it("returns icon from ViewDef", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ icon: "star" }), registry);
			expect(view.getIcon()).toBe("star");
		});
	});

	describe("hub metadata", () => {
		it("getHubId returns view type", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getHubId()).toBe("flowti-test-hub");
		});

		it("getHubType returns domain", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getHubType()).toBe("domain");
		});

		it("getHubDisplayName returns label", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ label: "Analytics" }), registry);
			expect(view.getHubDisplayName()).toBe("Analytics");
		});

		it("getHubIcon returns icon", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ icon: "bar-chart-2" }), registry);
			expect(view.getHubIcon()).toBe("bar-chart-2");
		});
	});

	describe("tab definitions", () => {
		it("maps ViewDef tabs to TabDef format", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const tabs = view.getTabDefinitions();
			expect(tabs).toHaveLength(2);
			expect(tabs[0]).toEqual({
				id: "tab1",
				label: "Tab One",
				icon: "star",
				searchPlaceholder: "Search tab one...",
			});
		});

		it("uses custom searchPlaceholder when provided", () => {
			const viewDef = createViewDef({
				tabs: [{ id: "t", label: "T", icon: "x", handler: "h", searchPlaceholder: "Find items..." }],
			});
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			expect(view.getTabDefinitions()[0].searchPlaceholder).toBe("Find items...");
		});

		it("returns empty array when no tabs defined", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ tabs: undefined }), registry);
			expect(view.getTabDefinitions()).toEqual([]);
		});
	});

	describe("tab rendering — handler path", () => {
		it("calls registered tab handler with container and context", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:tab1", handler);
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab1", container);
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(container, expect.objectContaining({
				tabId: "tab1",
				viewId: "flowti-test-hub",
			}));
		});

		it("does nothing when handler not registered", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab1", container);
			expect(container.children).toHaveLength(0);
		});
	});

	describe("tab rendering — component path", () => {
		it("creates Lit element when tab has component field", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab2", container);
			const el = container.querySelector("flowti-widget");
			expect(el).not.toBeNull();
		});

		it("binds data source to component properties", async () => {
			registry.registerDataSource("test:data", () => ({ items: [1, 2, 3], title: "Hello" }));
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab2", container);
			const el = container.querySelector("flowti-widget") as HTMLElement & Record<string, unknown>;
			expect(el).not.toBeNull();
			expect((el as Record<string, unknown>).items).toEqual([1, 2, 3]);
			expect((el as Record<string, unknown>).title).toBe("Hello");
		});
	});

	describe("refreshEvents", () => {
		it("subscribes to refreshEvents on hub open", () => {
			const viewDef = createViewDef({
				refreshEvents: ["test-mgmt.journey.registered", "settings.changed"],
			});
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			view.onHubOpen();
			expect(eventBus.on).toHaveBeenCalledWith(
				"test-mgmt.journey.registered",
				expect.any(Function),
			);
			expect(eventBus.on).toHaveBeenCalledWith(
				"settings.changed",
				expect.any(Function),
			);
		});

		it("does nothing when refreshEvents is undefined", () => {
			const viewDef = createViewDef({ refreshEvents: undefined });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			view.onHubOpen();
		});

		it("does nothing when refreshEvents is empty", () => {
			const viewDef = createViewDef({ refreshEvents: [] });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			view.onHubOpen();
		});

		it("registered callback triggers scheduleRender", () => {
			const viewDef = createViewDef({ refreshEvents: ["test-event"] });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			const scheduleSpy = vi.spyOn(view as unknown as { scheduleRender: () => void }, "scheduleRender");
			view.onHubOpen();
			const onCall = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.find(
				(c: unknown[]) => c[0] === "test-event"
			);
			expect(onCall).toBeDefined();
			(onCall![1] as () => void)();
			expect(scheduleSpy).toHaveBeenCalled();
		});

		it("unsubscribes on close", () => {
			const unsub = vi.fn();
			(eventBus.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
			const viewDef = createViewDef({ refreshEvents: ["test-event"] });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			view.onHubOpen();
			view.onHubClose();
		});
	});

	describe("searchText passthrough", () => {
		it("passes filterText as searchText in handler context", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:tab1", handler);
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			(view as unknown as { filterText: string }).filterText = "hello";
			const container = document.createElement("div");
			await view.renderTab("tab1", container);
			expect(handler).toHaveBeenCalledWith(container, expect.objectContaining({
				searchText: "hello",
			}));
		});
	});

	describe("dashboard handler delegation", () => {
		it("delegates to registered dashboard handler", () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:dashboard", handler);
			const viewDef = createViewDef({ type: "flowti-test-hub" });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			// Set up dashboardEl
			(view as unknown as { dashboardEl: HTMLElement }).dashboardEl = document.createElement("div");
			view.onDashboardRender();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("falls back to heading when no dashboard handler", () => {
			const viewDef = createViewDef({ label: "My Hub" });
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			const el = document.createElement("div");
			(view as unknown as { dashboardEl: HTMLElement }).dashboardEl = el;
			view.onDashboardRender();
			expect(el.querySelector("h2")?.textContent).toBe("My Hub");
		});
	});

	describe("tab rendering — unknown tab", () => {
		it("does nothing for unknown tab ID", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("nonexistent", container);
			expect(container.children).toHaveLength(0);
		});
	});
});
