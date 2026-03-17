import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DiscoveryService } from "../../../src/domain/discovery/DiscoveryService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { DiscoveryState } from "../../../src/domain/discovery/types";
import { createMockStorage } from "../../mocks/storage";

describe("DiscoveryService", () => {
	let service: DiscoveryService;
	let storage: ITypedStorage<DiscoveryState>;
	let getData: () => DiscoveryState | undefined;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage<DiscoveryState>();
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
			const mock = createMockStorage(existingState);
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

			const discovery = getData();
			expect(discovery?.events["daily.review"]).toBeDefined();
			expect(discovery?.events["daily.review"].triggerCount).toBe(1);
		});

		it("should persist state via typed storage", async () => {
			const mock = createMockStorage<DiscoveryState>();
			service = new DiscoveryService({
				storage: mock.storage,
				eventBus,
			});

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			const saved = mock.getData();
			expect(saved).toBeDefined();
			expect(saved?.events["daily.review"]).toBeDefined();
		});
	});

	// ── discovery.create ─────────────────────────────────────

	describe("discovery.create", () => {
		it("should create a new discovered event", async () => {
			const handler = vi.fn();
			eventBus.on("discovery.updated", handler);

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("order.placed");
			expect(events[0].triggerCount).toBe(0);
			expect(events[0].sourcePath).toBe("");

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						isNew: true,
						event: expect.objectContaining({ eventName: "order.placed" }),
					}),
				}),
			);
		});

		it("should not overwrite existing event", async () => {
			// First trigger it so it exists
			await eventBus.emit("event.file.triggered", {
				eventName: "order.placed",
				path: "Events/Order.md",
				action: "created",
			});

			const handler = vi.fn();
			eventBus.on("discovery.updated", handler);

			// Create with same name — should not overwrite
			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});

			const events = service.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].triggerCount).toBe(1); // preserved from trigger
			expect(events[0].sourcePath).toBe("Events/Order.md"); // preserved
			// Should NOT emit updated (no change)
			expect(handler).not.toHaveBeenCalled();
		});

		it("should include category when provided", async () => {
			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
				category: "Orders",
			});

			const events = service.getDiscoveredEvents();
			expect(events[0].category).toBe("Orders");
		});

		it("should persist after create", async () => {
			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});

			const discovery = getData();
			expect(discovery?.events["order.placed"]).toBeDefined();
		});

		it("should emit doc.create when docMeta is provided", async () => {
			const docHandler = vi.fn();
			eventBus.on("doc.create", docHandler);

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
				category: "Orders",
				docMeta: {
					description: "An order was placed",
					domain: "Orders",
					services: "OrderService",
					direction: "outbound",
					stability: "stable",
					visibility: "public",
				},
			});

			expect(docHandler).toHaveBeenCalledOnce();
			const payload = docHandler.mock.calls[0][0].payload;
			expect(payload.docType).toBe("EventDoc");
			expect(payload.name).toBe("order.placed");
			expect(payload.content).toContain("order.placed");
			expect(payload.content).toContain("An order was placed");
		});

		it("should include related events in doc content", async () => {
			const docHandler = vi.fn();
			eventBus.on("doc.create", docHandler);

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
				category: "Orders",
				docMeta: {
					description: "An order was placed",
					domain: "Orders",
					services: "OrderService",
					direction: "outbound",
					stability: "stable",
					visibility: "public",
					relatedEvents: [
						"- [[order.shipped\\|order.shipped]] — The order was shipped",
					],
				},
			});

			const content = docHandler.mock.calls[0][0].payload.content as string;
			expect(content).toContain("order.shipped");
		});

		it("should include extra sections in doc content", async () => {
			const docHandler = vi.fn();
			eventBus.on("doc.create", docHandler);

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
				category: "Orders",
				docMeta: {
					description: "An order was placed",
					domain: "Orders",
					services: "OrderService",
					direction: "outbound",
					stability: "stable",
					visibility: "public",
					extraSections: ["**Type**: [[Type - Order\\|Order]]"],
				},
			});

			const content = docHandler.mock.calls[0][0].payload.content as string;
			expect(content).toContain("Type - Order");
		});

		it("should not emit doc.create when docMeta is absent", async () => {
			const docHandler = vi.fn();
			eventBus.on("doc.create", docHandler);

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});

			expect(docHandler).not.toHaveBeenCalled();
		});
	});

	// ── discovery.remove ─────────────────────────────────────

	describe("discovery.remove", () => {
		it("should remove existing event", async () => {
			// Create first
			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});
			expect(service.getDiscoveredEvents()).toHaveLength(1);

			// Remove
			await eventBus.emit("discovery.remove", {
				eventName: "order.placed",
			});

			expect(service.getDiscoveredEvents()).toHaveLength(0);
		});

		it("should emit discovery.removed", async () => {
			await eventBus.emit("discovery.create", { eventName: "order.placed" });

			const handler = vi.fn();
			eventBus.on("discovery.removed", handler);

			await eventBus.emit("discovery.remove", { eventName: "order.placed" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { eventName: "order.placed" },
				}),
			);
		});

		it("should persist after remove", async () => {
			await eventBus.emit("discovery.create", { eventName: "order.placed" });
			await eventBus.emit("discovery.remove", { eventName: "order.placed" });

			const discovery = getData();
			expect(discovery?.events["order.placed"]).toBeUndefined();
		});

		it("should be a no-op for nonexistent event", async () => {
			const handler = vi.fn();
			eventBus.on("discovery.removed", handler);

			await eventBus.emit("discovery.remove", { eventName: "nonexistent" });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── emitCustom on trigger ────────────────────────────────

	describe("emitCustom on trigger", () => {
		it("should fire custom event on event.file.triggered", async () => {
			const wildcardHandler = vi.fn();
			eventBus.on("*", wildcardHandler);

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			// Find the emitCustom call — it will show up as a wildcard event
			const customCalls = wildcardHandler.mock.calls.filter(
				(c: unknown[]) => (c[0] as { type: string }).type === "daily.review",
			);
			expect(customCalls).toHaveLength(1);
		});

		it("should include sourcePath in custom event payload", async () => {
			const wildcardHandler = vi.fn();
			eventBus.on("*", wildcardHandler);

			await eventBus.emit("event.file.triggered", {
				eventName: "weekly.planning",
				path: "Events/Weekly Planning.md",
				action: "created",
			});

			const customCalls = wildcardHandler.mock.calls.filter(
				(c: unknown[]) => (c[0] as { type: string }).type === "weekly.planning",
			);
			expect(customCalls).toHaveLength(1);
			expect((customCalls[0][0] as { payload: { sourcePath: string } }).payload.sourcePath).toBe("Events/Weekly Planning.md");
		});
	});

	// ── Construction without eventBus ────────────────────────

	describe("construction without eventBus", () => {
		it("should function without event bus", async () => {
			const mock = createMockStorage<DiscoveryState>();
			const noBusService = new DiscoveryService({ storage: mock.storage });

			await noBusService.load();
			expect(noBusService.getDiscoveredEvents()).toEqual([]);
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

		it("should stop listening to discovery.create after dispose", async () => {
			service.dispose();

			await eventBus.emit("discovery.create", {
				eventName: "order.placed",
			});

			expect(service.getDiscoveredEvents()).toHaveLength(0);
		});

		it("should stop listening to discovery.remove after dispose", async () => {
			// Create event before disposing
			await eventBus.emit("discovery.create", { eventName: "order.placed" });
			expect(service.getDiscoveredEvents()).toHaveLength(1);

			service.dispose();

			await eventBus.emit("discovery.remove", { eventName: "order.placed" });
			// Still there because we disposed before the remove
			expect(service.getDiscoveredEvents()).toHaveLength(1);
		});
	});
});
