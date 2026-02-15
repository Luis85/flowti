import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SubscriptionService } from "../../../src/domain/subscription/SubscriptionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { SubscriptionState } from "../../../src/domain/subscription/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

/**
 * Creates a mock typed storage for testing.
 */
function createMockStorage(initialState?: SubscriptionState): {
	storage: ITypedStorage<SubscriptionState>;
	getData: () => SubscriptionState | undefined;
} {
	let data: SubscriptionState | undefined = initialState;
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (state: SubscriptionState) => {
				data = state;
			}),
			safeLoad: vi.fn(async () => data),
			safeSave: vi.fn(async (state: SubscriptionState) => {
				data = state;
				return true;
			}),
		},
		getData: () => data,
	};
}

describe("SubscriptionService", () => {
	let service: SubscriptionService;
	let storage: ITypedStorage<SubscriptionState>;
	let getData: () => SubscriptionState | undefined;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		service = new SubscriptionService({ storage, eventBus });
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getSubscriptions()).toEqual([]);
		});

		it("should load persisted subscription state", async () => {
			const existingState: SubscriptionState = {
				subscriptions: {
					sub1: {
						id: "sub1",
						eventType: "file.created",
						filters: { pathPattern: "Reports/**" },
						enabled: true,
						createdAt: "2026-01-01T00:00:00Z",
					},
				},
			};
			const mock = createMockStorage(existingState);
			service = new SubscriptionService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSubscriptions()).toHaveLength(1);
			expect(service.getSubscription("sub1")).toBeDefined();
			expect(service.getSubscription("sub1")?.eventType).toBe("file.created");
		});

		it("should emit subscription.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "subscription.loaded",
					payload: { subscriptions: [] },
				})
			);
		});
	});

	describe("create", () => {
		it("should create a subscription via command event", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.created", handler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Reports",
				filters: { pathPattern: "Reports/**" },
			});

			expect(service.getSubscriptions()).toHaveLength(1);
			const sub = service.getSubscriptions()[0];
			expect(sub.eventType).toBe("file.created");
			expect(sub.label).toBe("Reports");
			expect(sub.filters.pathPattern).toBe("Reports/**");
			expect(sub.enabled).toBe(true);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should persist state after create", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});

			const state = getData();
			expect(Object.keys(state!.subscriptions)).toHaveLength(1);
		});
	});

	describe("update", () => {
		it("should update a subscription's label", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Original",
				filters: {},
			});
			const sub = service.getSubscriptions()[0];

			const handler = vi.fn();
			eventBus.on("subscription.updated", handler);

			await eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				label: "Updated",
			});

			expect(service.getSubscription(sub.id)?.label).toBe("Updated");
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should update a subscription's enabled state", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});
			const sub = service.getSubscriptions()[0];
			expect(sub.enabled).toBe(true);

			await eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: false,
			});

			expect(service.getSubscription(sub.id)?.enabled).toBe(false);
		});

		it("should ignore update for non-existent subscription", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.updated", handler);

			await eventBus.emit("subscription.update", {
				subscriptionId: "nonexistent",
				label: "Test",
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("remove", () => {
		it("should remove a subscription", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});
			const sub = service.getSubscriptions()[0];

			const handler = vi.fn();
			eventBus.on("subscription.deleted", handler);

			await eventBus.emit("subscription.remove", {
				subscriptionId: sub.id,
			});

			expect(service.getSubscriptions()).toHaveLength(0);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { subscriptionId: sub.id },
				})
			);
		});

		it("should ignore remove for non-existent subscription", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.deleted", handler);

			await eventBus.emit("subscription.remove", {
				subscriptionId: "nonexistent",
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("matching", () => {
		it("should emit subscription.matched when event type matches", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "All files",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.created", {
				path: "test.md",
				source: "user",
			});

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "subscription.matched",
					payload: expect.objectContaining({
						eventType: "file.created",
						subscriptionLabel: "All files",
					}),
				})
			);
		});

		it("should match with pathPattern filter", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: { pathPattern: "Reports/**" },
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// Matching path
			await eventBus.emit("file.created", {
				path: "Reports/daily/jan.csv",
				source: "sync",
			});
			expect(handler).toHaveBeenCalledTimes(1);

			// Non-matching path
			handler.mockClear();
			await eventBus.emit("file.created", {
				path: "Other/jan.csv",
				source: "sync",
			});
			expect(handler).not.toHaveBeenCalled();
		});

		it("should match with extension filter", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: { extension: "csv" },
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.created", {
				path: "data.csv",
				source: "user",
			});
			expect(handler).toHaveBeenCalledTimes(1);

			handler.mockClear();
			await eventBus.emit("file.created", {
				path: "data.md",
				source: "user",
			});
			expect(handler).not.toHaveBeenCalled();
		});

		it("should match with namePattern filter", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: { namePattern: "report-*.csv" },
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.created", {
				path: "Reports/report-2026.csv",
				source: "sync",
			});
			expect(handler).toHaveBeenCalledTimes(1);

			handler.mockClear();
			await eventBus.emit("file.created", {
				path: "Reports/other-2026.csv",
				source: "sync",
			});
			expect(handler).not.toHaveBeenCalled();
		});

		it("should use AND logic for multiple filters", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {
					pathPattern: "Reports/**",
					extension: "csv",
				},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// Both match
			await eventBus.emit("file.created", {
				path: "Reports/jan.csv",
				source: "sync",
			});
			expect(handler).toHaveBeenCalledTimes(1);

			// Path matches, extension doesn't
			handler.mockClear();
			await eventBus.emit("file.created", {
				path: "Reports/jan.md",
				source: "sync",
			});
			expect(handler).not.toHaveBeenCalled();

			// Extension matches, path doesn't
			handler.mockClear();
			await eventBus.emit("file.created", {
				path: "Other/jan.csv",
				source: "sync",
			});
			expect(handler).not.toHaveBeenCalled();
		});

		it("should not match disabled subscriptions", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});
			const sub = service.getSubscriptions()[0];

			await eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: false,
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.created", {
				path: "test.md",
				source: "user",
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should not match different event types", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.modified", {
				path: "test.md",
				source: "user",
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should skip subscription.* events to avoid loops", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "subscription.created",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// This should be skipped by the SKIPPED_PREFIXES guard
			await eventBus.emit("subscription.created", {
				subscription: {
					id: "test",
					eventType: "file.created",
					filters: {},
					enabled: true,
					createdAt: new Date().toISOString(),
				},
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("master toggle", () => {
		it("should not match when disabled via settings.changed", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "All files",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// Disable the event system
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("file.created", {
				path: "test.md",
				source: "user",
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should re-enable matching when settings.changed sets eventSystemEnabled back to true", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "All files",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// Disable
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});
			await eventBus.emit("file.created", { path: "a.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();

			// Re-enable
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
			});
			await eventBus.emit("file.created", { path: "b.md", source: "user" });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should respect settings.loaded for initial state", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			// Simulate settings loaded with disabled
			await eventBus.emit("settings.loaded", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("persistence", () => {
		it("should persist state via typed storage", async () => {
			const mock = createMockStorage();
			service = new SubscriptionService({ storage: mock.storage, eventBus });

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});

			const saved = mock.getData();
			expect(saved).toBeDefined();
			expect(Object.keys(saved!.subscriptions)).toHaveLength(1);
		});
	});

	describe("refresh", () => {
		it("should re-emit subscription.loaded on subscription.refresh", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Test",
				filters: {},
			});

			const handler = vi.fn();
			eventBus.on("subscription.loaded", handler);

			await eventBus.emit("subscription.refresh", {});

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "subscription.loaded",
					payload: {
						subscriptions: expect.arrayContaining([
							expect.objectContaining({ eventType: "file.created", label: "Test" }),
						]),
					},
				})
			);
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			const handler = vi.fn();
			eventBus.on("subscription.created", handler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});

			expect(handler).not.toHaveBeenCalled();
			expect(service.getSubscriptions()).toHaveLength(0);
		});

		it("should stop wildcard matching after dispose", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				filters: {},
			});
			expect(service.getSubscriptions()).toHaveLength(1);

			service.dispose();

			const handler = vi.fn();
			eventBus.on("subscription.matched", handler);

			await eventBus.emit("file.created", {
				path: "test.md",
				source: "user",
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
