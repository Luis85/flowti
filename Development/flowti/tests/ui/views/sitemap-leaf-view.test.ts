// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { SitemapLeafView } from "../../../src/ui/views/sitemap-leaf-view";
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

function createLeafDef(overrides?: Partial<ViewDef>): ViewDef {
	return {
		kind: "leaf",
		label: "Test Leaf",
		icon: "file-text",
		type: "flowti-test-leaf",
		...overrides,
	};
}

describe("SitemapLeafView", () => {
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
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef(), registry);
			expect(view.getViewType()).toBe("flowti-test-leaf");
		});

		it("returns display text from ViewDef label", () => {
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef({ label: "My Leaf" }), registry);
			expect(view.getDisplayText()).toBe("My Leaf");
		});

		it("returns icon from ViewDef", () => {
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef({ icon: "star" }), registry);
			expect(view.getIcon()).toBe("star");
		});
	});

	describe("handler-based rendering", () => {
		it("calls registered handler with container and context on open", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:main", handler);
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			await view.onOpen();
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				view.contentEl,
				expect.objectContaining({
					tabId: "main",
					viewId: "flowti-test-leaf",
				}),
			);
		});

		it("does nothing when handler not registered", async () => {
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "missing:handler" }),
				registry,
			);
			await view.onOpen();
			expect(view.contentEl.children).toHaveLength(0);
		});
	});

	describe("component-based rendering", () => {
		it("creates Lit element when ViewDef has component field", async () => {
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ component: "flowti-test-widget" }),
				registry,
			);
			await view.onOpen();
			const el = view.contentEl.querySelector("flowti-test-widget");
			expect(el).not.toBeNull();
		});
	});

	describe("refreshEvents", () => {
		it("subscribes to refreshEvents on open", async () => {
			const viewDef = createLeafDef({
				refreshEvents: ["data.changed", "settings.updated"],
			});
			const view = new SitemapLeafView(leaf, eventBus, viewDef, registry);
			await view.onOpen();
			expect(eventBus.on).toHaveBeenCalledWith(
				"data.changed",
				expect.any(Function),
			);
			expect(eventBus.on).toHaveBeenCalledWith(
				"settings.updated",
				expect.any(Function),
			);
		});

		it("does nothing when refreshEvents is undefined", async () => {
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef(), registry);
			await view.onOpen();
			expect(eventBus.on).not.toHaveBeenCalled();
		});

		it("refresh callback re-renders via handler", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:main", handler);
			const viewDef = createLeafDef({
				handler: "test:main",
				refreshEvents: ["test-event"],
			});
			const view = new SitemapLeafView(leaf, eventBus, viewDef, registry);
			await view.onOpen();
			expect(handler).toHaveBeenCalledTimes(1);

			// Trigger refresh callback
			const onCall = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.find(
				(c: unknown[]) => c[0] === "test-event"
			);
			expect(onCall).toBeDefined();
			(onCall![1] as () => void)();

			// Handler called again for refresh
			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("unsubscribes on close", async () => {
			const unsub = vi.fn();
			(eventBus.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
			const viewDef = createLeafDef({ refreshEvents: ["test-event"] });
			const view = new SitemapLeafView(leaf, eventBus, viewDef, registry);
			await view.onOpen();
			await view.onClose();
			expect(unsub).toHaveBeenCalled();
		});
	});

	describe("cleanup", () => {
		it("empties unsubscribes array on close", async () => {
			const unsub = vi.fn();
			(eventBus.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
			const viewDef = createLeafDef({ refreshEvents: ["a", "b"] });
			const view = new SitemapLeafView(leaf, eventBus, viewDef, registry);
			await view.onOpen();
			await view.onClose();
			// Closing again should not call unsub again
			await view.onClose();
			expect(unsub).toHaveBeenCalledTimes(2); // once per event, not doubled
		});
	});

	describe("rendering priority", () => {
		it("prefers handler over component when both specified", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:main", handler);
			const viewDef = createLeafDef({
				handler: "test:main",
				component: "flowti-ignored-widget",
			});
			const view = new SitemapLeafView(leaf, eventBus, viewDef, registry);
			await view.onOpen();
			expect(handler).toHaveBeenCalledTimes(1);
			expect(view.contentEl.querySelector("flowti-ignored-widget")).toBeNull();
		});

		it("renders nothing when neither handler nor component specified", async () => {
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef(), registry);
			await view.onOpen();
			expect(view.contentEl.children).toHaveLength(0);
		});
	});
});
