import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { EventNotificationService } from "../../../src/domain/eventNotify/EventNotificationService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { EventNotifyState } from "../../../src/domain/eventNotify/types";
import { createMockStorage } from "../../mocks/storage";

describe("EventNotificationService", () => {
	let service: EventNotificationService;
	let storage: ITypedStorage<EventNotifyState>;
	let getData: () => EventNotifyState | undefined;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage<EventNotifyState>();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		service = new EventNotificationService({ storage, eventBus });
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getNotifiedTypes()).toEqual([]);
		});

		it("should load persisted notify state", async () => {
			const existingState: EventNotifyState = {
				notifiedTypes: ["file.created", "user.created"],
			};
			const mock = createMockStorage(existingState);
			service = new EventNotificationService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.isNotified("file.created")).toBe(true);
			expect(service.isNotified("user.created")).toBe(true);
			expect(service.isNotified("file.deleted")).toBe(false);
		});

		it("should emit eventNotify.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("eventNotify.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "eventNotify.loaded",
					payload: { notifiedTypes: [] },
				})
			);
		});

		it("should emit eventNotify.loaded with persisted notifications", async () => {
			const existingState: EventNotifyState = {
				notifiedTypes: ["user.created"],
			};
			const mock = createMockStorage(existingState);
			service = new EventNotificationService({ storage: mock.storage, eventBus });

			const handler = vi.fn();
			eventBus.on("eventNotify.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { notifiedTypes: ["user.created"] },
				})
			);
		});
	});

	describe("toggle", () => {
		it("should add an event type when toggled", async () => {
			const handler = vi.fn();
			eventBus.on("eventNotify.changed", handler);

			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });

			expect(service.isNotified("file.created")).toBe(true);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { notifiedTypes: ["file.created"] },
				})
			);
		});

		it("should remove an event type when toggled again", async () => {
			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });
			expect(service.isNotified("file.created")).toBe(true);

			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });
			expect(service.isNotified("file.created")).toBe(false);
		});

		it("should persist state after toggle", async () => {
			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });

			const notify = getData();
			expect(notify?.notifiedTypes).toContain("file.created");
		});
	});

	describe("wildcard listener (fire notifications)", () => {
		it("should emit eventNotify.fired when a notified event fires", async () => {
			// Enable notifications for file.created
			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });

			const handler = vi.fn();
			eventBus.on("eventNotify.fired", handler);

			// Emit the event that should trigger a notification
			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "eventNotify.fired",
					payload: expect.objectContaining({
						eventType: "file.created",
					}),
				})
			);
		});

		it("should not emit eventNotify.fired for non-notified events", async () => {
			const handler = vi.fn();
			eventBus.on("eventNotify.fired", handler);

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should skip log.* events to avoid infinite loops", async () => {
			await eventBus.emit("eventNotify.toggle", { eventType: "log.entry" });

			const handler = vi.fn();
			eventBus.on("eventNotify.fired", handler);

			await eventBus.emit("log.entry", {
				level: "info",
				message: "test",
				timestamp: new Date().toISOString(),
			});

			expect(handler).not.toHaveBeenCalled();
		});

		it("should skip eventNotify.* events to avoid infinite loops", async () => {
			await eventBus.emit("eventNotify.toggle", { eventType: "eventNotify.changed" });

			const handler = vi.fn();
			eventBus.on("eventNotify.fired", handler);

			await eventBus.emit("eventNotify.changed", { notifiedTypes: [] });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("persistence", () => {
		it("should persist state via typed storage", async () => {
			const mock = createMockStorage<EventNotifyState>();
			service = new EventNotificationService({ storage: mock.storage, eventBus });

			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });

			const saved = mock.getData();
			expect(saved).toBeDefined();
			expect(saved?.notifiedTypes).toContain("file.created");
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			const handler = vi.fn();
			eventBus.on("eventNotify.changed", handler);

			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });
			expect(handler).not.toHaveBeenCalled();
			expect(service.isNotified("file.created")).toBe(false);
		});

		it("should stop wildcard listener after dispose", async () => {
			// Enable notifications for file.created before disposing
			await eventBus.emit("eventNotify.toggle", { eventType: "file.created" });
			expect(service.isNotified("file.created")).toBe(true);

			service.dispose();

			const handler = vi.fn();
			eventBus.on("eventNotify.fired", handler);

			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();
		});
	});
});
