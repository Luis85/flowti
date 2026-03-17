import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { HubRegistry } from "../../../src/domain/hub/HubRegistry";
import type { HubDashboardProvider, IViewNavigator } from "../../../src/domain/hub/types";

// ── Helpers ──────────────────────────────────────────────────

function makeProvider(overrides?: Partial<HubDashboardProvider>): HubDashboardProvider {
	return {
		getHubId: () => "test-hub",
		getViewType: () => "test-hub-view",
		getDisplayName: () => "Test Hub",
		getIcon: () => "list",
		getSummary: () => ({
			stats: [{ label: "Items", value: "5", icon: "list" }],
			healthLevel: "healthy",
			actionItemCount: 0,
		}),
		...overrides,
	};
}

function makeNavigator(): IViewNavigator & { openView: ReturnType<typeof vi.fn> } {
	return { openView: vi.fn().mockResolvedValue(undefined) };
}

describe("HubRegistry", () => {
	let eventBus: IEventBus;
	let navigator: ReturnType<typeof makeNavigator>;
	let registry: HubRegistry;

	beforeEach(() => {
		eventBus = new EventBus();
		navigator = makeNavigator();
		registry = new HubRegistry(navigator, eventBus);
	});

	// ── Registration ────────────────────────────────────────

	describe("registration", () => {
		it("should register and retrieve a provider by ID", () => {
			const provider = makeProvider();
			registry.register(provider);

			expect(registry.get("test-hub")).toBe(provider);
		});

		it("should return undefined for unregistered hub ID", () => {
			expect(registry.get("nonexistent")).toBeUndefined();
		});

		it("should list all registered providers", () => {
			registry.register(makeProvider({ getHubId: () => "hub-a" }));
			registry.register(makeProvider({ getHubId: () => "hub-b" }));

			const all = registry.getAll();
			expect(all).toHaveLength(2);
			expect(all.map((p) => p.getHubId())).toEqual(["hub-a", "hub-b"]);
		});

		it("should unregister a provider", () => {
			registry.register(makeProvider());
			expect(registry.get("test-hub")).toBeDefined();

			registry.unregister("test-hub");
			expect(registry.get("test-hub")).toBeUndefined();
		});

		it("should overwrite existing provider with same hub ID", () => {
			const first = makeProvider({ getDisplayName: () => "First" });
			const second = makeProvider({ getDisplayName: () => "Second" });

			registry.register(first);
			registry.register(second);

			expect(registry.get("test-hub")!.getDisplayName()).toBe("Second");
			expect(registry.getAll()).toHaveLength(1);
		});
	});

	// ── Navigation ──────────────────────────────────────────

	describe("openHub", () => {
		it("should do nothing for unknown hub ID", async () => {
			await registry.openHub("nonexistent");

			expect(navigator.openView).not.toHaveBeenCalled();
		});

		it("should delegate to navigator with the view type", async () => {
			registry.register(makeProvider());

			await registry.openHub("test-hub");

			expect(navigator.openView).toHaveBeenCalledWith("test-hub-view");
		});

		it("should NOT emit hub.navigate when no tabId is provided", async () => {
			registry.register(makeProvider());
			const navigateSpy = vi.fn();
			eventBus.on("hub.navigate", navigateSpy);

			await registry.openHub("test-hub");

			expect(navigateSpy).not.toHaveBeenCalled();
		});

		it("should emit hub.navigate with tabId when provided", async () => {
			registry.register(makeProvider());
			const navigateSpy = vi.fn();
			eventBus.on("hub.navigate", navigateSpy);

			await registry.openHub("test-hub", "events");

			expect(navigateSpy).toHaveBeenCalledOnce();
			expect(navigateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { hubId: "test-hub", tabId: "events", entityId: undefined },
				}),
			);
		});

		it("should emit hub.navigate with tabId and entityId", async () => {
			registry.register(makeProvider());
			const navigateSpy = vi.fn();
			eventBus.on("hub.navigate", navigateSpy);

			await registry.openHub("test-hub", "events", "file.created");

			expect(navigateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { hubId: "test-hub", tabId: "events", entityId: "file.created" },
				}),
			);
		});
	});
});
