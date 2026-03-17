// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { SitemapLeafView } from "../../../src/ui/views/sitemap-leaf-view";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { TabHandler } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { ViewDef } from "../../../src/domain/sitemap/plugin-sitemap-types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { WorkspaceLeaf } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockTabHandler(): TabHandler & { mock: { calls: any[][] } } {
	return vi.fn() as unknown as TabHandler & { mock: { calls: any[][] } };
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
			const handler = mockTabHandler();
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

		it("shows loading indicator when handler not registered", async () => {
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "missing:handler" }),
				registry,
			);
			await view.onOpen();
			const loading = view.contentEl.querySelector(".flowti-loading");
			expect(loading).not.toBeNull();
			expect(loading!.textContent).toBe("Loading...");
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
			const handler = mockTabHandler();
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
			const handler = mockTabHandler();
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

	describe("getState / setState", () => {
		it("getState returns base type when no handler defined", () => {
			const view = new SitemapLeafView(leaf, eventBus, createLeafDef(), registry);
			expect(view.getState()).toEqual({ type: "flowti-test-leaf" });
		});

		it("getState returns base type when handler has no getState", () => {
			const handler = mockTabHandler();
			registry.registerTabHandler("test:main", handler);
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			expect(view.getState()).toEqual({ type: "flowti-test-leaf" });
		});

		it("getState merges handler state with base state", () => {
			const handler = vi.fn() as unknown as TabHandler & { getState: () => Record<string, unknown> };
			handler.getState = () => ({ scrollPos: 42, filter: "active" });
			registry.registerTabHandler("test:main", handler);
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			expect(view.getState()).toEqual({ type: "flowti-test-leaf", scrollPos: 42, filter: "active" });
		});

		it("setState stores state and triggers refresh", async () => {
			const handler = mockTabHandler();
			registry.registerTabHandler("test:main", handler);
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			await view.onOpen();
			expect(handler).toHaveBeenCalledTimes(1);

			await view.setState({ filter: "done" }, { history: false });
			// Handler called again (refresh from setState)
			expect(handler).toHaveBeenCalledTimes(2);
			// savedState passed to handler via context
			const lastCtx = handler.mock.calls[1][1];
			expect(lastCtx.savedState).toEqual({ filter: "done" });
		});

		it("setState does not pass savedState when state is empty", async () => {
			const handler = mockTabHandler();
			registry.registerTabHandler("test:main", handler);
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			await view.onOpen();
			const firstCtx = handler.mock.calls[0][1];
			expect(firstCtx.savedState).toBeUndefined();
		});
	});

	describe("handler timing gap", () => {
		it("shows loading then renders handler once onLayoutReady fires", async () => {
			const onLayoutReady = vi.fn((cb: () => void) => cb());
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "deferred:handler" }),
				registry,
			);
			// Mock app.workspace.onLayoutReady
			(view as unknown as { app: { workspace: { onLayoutReady: typeof onLayoutReady } } }).app = {
				workspace: { onLayoutReady },
			} as never;

			await view.onOpen();
			// onLayoutReady was called because handler was missing
			expect(onLayoutReady).toHaveBeenCalledTimes(1);
		});

		it("does not call onLayoutReady when handler is available", async () => {
			const handler = mockTabHandler();
			registry.registerTabHandler("test:main", handler);
			const onLayoutReady = vi.fn();
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "test:main" }),
				registry,
			);
			(view as unknown as { app: { workspace: { onLayoutReady: typeof onLayoutReady } } }).app = {
				workspace: { onLayoutReady },
			} as never;

			await view.onOpen();
			expect(onLayoutReady).not.toHaveBeenCalled();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("re-renders with handler when onLayoutReady callback fires after registration", async () => {
			let layoutCallback: (() => void) | undefined;
			const onLayoutReady = vi.fn((cb: () => void) => { layoutCallback = cb; });
			const view = new SitemapLeafView(
				leaf, eventBus,
				createLeafDef({ handler: "late:handler" }),
				registry,
			);
			(view as unknown as { app: { workspace: { onLayoutReady: typeof onLayoutReady } } }).app = {
				workspace: { onLayoutReady },
			} as never;

			await view.onOpen();
			// Loading indicator shown
			expect(view.contentEl.querySelector(".flowti-loading")).not.toBeNull();

			// Now register the handler and fire the callback
			const handler = mockTabHandler();
			registry.registerTabHandler("late:handler", handler);
			layoutCallback!();

			// Handler should now be called, loading removed
			expect(handler).toHaveBeenCalledTimes(1);
			expect(view.contentEl.querySelector(".flowti-loading")).toBeNull();
		});
	});
});
