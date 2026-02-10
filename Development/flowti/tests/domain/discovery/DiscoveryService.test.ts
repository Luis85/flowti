import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DiscoveryService } from "../../../src/domain/discovery/DiscoveryService";
import type { IStorageProvider } from "../../../src/utils/types";
import type { DiscoveryState } from "../../../src/domain/discovery/types";

/**
 * Creates a mock storage provider for testing.
 */
function createMockStorage(initialData: Record<string, unknown> = {}): {
	storage: IStorageProvider;
	getData: () => Record<string, unknown>;
} {
	let data = { ...initialData };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (newData: unknown) => {
				data = newData as Record<string, unknown>;
			}),
		},
		getData: () => data,
	};
}

describe("DiscoveryService", () => {
	let service: DiscoveryService;
	let storage: IStorageProvider;
	let getData: () => Record<string, unknown>;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		service = new DiscoveryService({ storage, eventBus });
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getDiscoveredEvents()).toEqual([]);
		});

		it("should load persisted discovery state", async () => {
			const existingState: DiscoveryState = {
				events: {
					"daily.review": {
						eventName: "daily.review",
						sourcePath: "Events/Daily Review.md",
						firstSeenAt: "2026-01-01T00:00:00.000Z",
						lastSeenAt: "2026-01-15T00:00:00.000Z",
						triggerCount: 5,
					},
				},
			};
			const mock = createMockStorage({ discovery: existingState });
			storage = mock.storage;
			service = new DiscoveryService({ storage, eventBus });

			await service.load();

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("daily.review");
			expect(events[0].triggerCount).toBe(5);
		});

		it("should emit discovery.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("discovery.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "discovery.loaded",
					payload: { discoveredEvents: [] },
				})
			);
		});
	});

	describe("event.file.triggered handling", () => {
		it("should discover a new event on event.file.triggered", async () => {
			const handler = vi.fn();
			eventBus.on("discovery.updated", handler);

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("daily.review");
			expect(events[0].sourcePath).toBe("Events/Daily Review.md");
			expect(events[0].triggerCount).toBe(1);

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						isNew: true,
						event: expect.objectContaining({
							eventName: "daily.review",
						}),
					}),
				})
			);
		});

		it("should increment triggerCount on repeat triggers", async () => {
			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "modified",
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "modified",
			});

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].triggerCount).toBe(3);
		});

		it("should emit discovery.updated with isNew=false on repeat triggers", async () => {
			const handler = vi.fn();
			eventBus.on("discovery.updated", handler);

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "modified",
			});

			expect(handler).toHaveBeenCalledTimes(2);
			expect(handler.mock.calls[0][0].payload.isNew).toBe(true);
			expect(handler.mock.calls[1][0].payload.isNew).toBe(false);
		});

		it("should track multiple different events", async () => {
			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "weekly.planning",
				path: "Events/Weekly Planning.md",
				action: "created",
			});

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(2);
			const names = events.map((e) => e.eventName).sort();
			expect(names).toEqual(["daily.review", "weekly.planning"]);
		});
	});

	describe("persistence", () => {
		it("should persist state after discovering an event", async () => {
			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			const data = getData();
			const discovery = data.discovery as DiscoveryState;
			expect(discovery.events["daily.review"]).toBeDefined();
			expect(discovery.events["daily.review"].triggerCount).toBe(1);
		});

		it("should preserve other storage keys when saving", async () => {
			const mock = createMockStorage({ someOtherKey: "preserved" });
			service = new DiscoveryService({
				storage: mock.storage,
				eventBus,
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			const data = mock.getData();
			expect(data.someOtherKey).toBe("preserved");
			expect(data.discovery).toBeDefined();
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			expect(service.getDiscoveredEvents()).toHaveLength(0);
		});
	});
});
