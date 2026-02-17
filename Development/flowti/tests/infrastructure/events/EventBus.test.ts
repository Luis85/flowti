import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { FlowtiUser } from "../../../src/domain/user/types";
import type { UUID } from "../../../src/utils/types";
import { DEFAULT_ENTITY_PATHS } from "../../../src/domain/settings/settings";

describe("EventBus", () => {
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe("on/emit", () => {
		it("should call handler when event is emitted", async () => {
			const handler = vi.fn();
			eventBus.on("user.created", handler);

			const user: FlowtiUser = {
				id: "test-uuid" as UUID,
				name: "Test User",
				createdAt: "2024-01-01T00:00:00.000Z",
			};
			await eventBus.emit("user.created", { user });

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "user.created",
					payload: { user },
					timestamp: expect.any(String),
				})
			);
		});

		it("should call multiple handlers for same event type", async () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			eventBus.on("user.updated", handler1);
			eventBus.on("user.updated", handler2);

			await eventBus.emit("user.updated", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler1).toHaveBeenCalledOnce();
			expect(handler2).toHaveBeenCalledOnce();
		});

		it("should not call handlers for different event types", async () => {
			const userHandler = vi.fn();
			const settingsHandler = vi.fn();
			eventBus.on("user.created", userHandler);
			eventBus.on("settings.changed", settingsHandler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(userHandler).toHaveBeenCalledOnce();
			expect(settingsHandler).not.toHaveBeenCalled();
		});

		it("should support async handlers", async () => {
			const results: number[] = [];
			const asyncHandler = vi.fn(async () => {
				await new Promise((r) => setTimeout(r, 10));
				results.push(1);
			});
			eventBus.on("user.created", asyncHandler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(results).toEqual([1]);
		});
	});

	describe("off", () => {
		it("should remove handler", async () => {
			const handler = vi.fn();
			eventBus.on("user.created", handler);
			eventBus.off("user.created", handler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("unsubscribe function", () => {
		it("should return unsubscribe function from on()", async () => {
			const handler = vi.fn();
			const unsubscribe = eventBus.on("user.created", handler);

			unsubscribe();

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("clear", () => {
		it("should remove all handlers", async () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			eventBus.on("user.created", handler1);
			eventBus.on("settings.changed", handler2);

			eventBus.clear();

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});
			await eventBus.emit("settings.changed", { settings: { debugMode: true, eventSystemEnabled: true, showSystemEvents: false, docsRootPath: "events", catalogCategories: [], catalogDomains: [], catalogServices: [], collapsedCategories: [], ingestionConcurrency: 3, ingestionBatchWindowMs: 500, ingestionMaxRetries: 3, ingestionWatchEventTypes: [], watchFolders: [], entityPaths: DEFAULT_ENTITY_PATHS, sessionActivityFilterGlobal: [], inboxEnabledSources: [], } });

			expect(handler1).not.toHaveBeenCalled();
			expect(handler2).not.toHaveBeenCalled();
		});
	});

	describe("event structure", () => {
		it("should include timestamp in event", async () => {
			const handler = vi.fn();
			eventBus.on("user.created", handler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			const event = handler.mock.calls[0][0];
			expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});
	});

	describe("wildcard listener", () => {
		it("should call wildcard handler for any event", async () => {
			const wildcardHandler = vi.fn();
			eventBus.on("*", wildcardHandler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});
			await eventBus.emit("settings.changed", { settings: { debugMode: true, eventSystemEnabled: true, showSystemEvents: false, docsRootPath: "events", catalogCategories: [], catalogDomains: [], catalogServices: [], collapsedCategories: [], ingestionConcurrency: 3, ingestionBatchWindowMs: 500, ingestionMaxRetries: 3, ingestionWatchEventTypes: [], watchFolders: [], entityPaths: DEFAULT_ENTITY_PATHS, sessionActivityFilterGlobal: [], inboxEnabledSources: [], } });

			expect(wildcardHandler).toHaveBeenCalledTimes(2);
			expect(wildcardHandler.mock.calls[0][0].type).toBe("user.created");
			expect(wildcardHandler.mock.calls[1][0].type).toBe("settings.changed");
		});

		it("should call wildcard handler after type-specific handlers", async () => {
			const order: string[] = [];
			eventBus.on("user.created", () => { order.push("specific"); });
			eventBus.on("*", () => { order.push("wildcard"); });

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(order).toEqual(["specific", "wildcard"]);
		});

		it("should unsubscribe wildcard handler", async () => {
			const handler = vi.fn();
			const unsubscribe = eventBus.on("*", handler);

			unsubscribe();

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("once", () => {
		it("should call handler only once", async () => {
			const handler = vi.fn();
			eventBus.once("user.created", handler);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});
			await eventBus.emit("user.created", {
				user: { id: "id2" as UUID, name: "Name2", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler).toHaveBeenCalledOnce();
		});

		it("should return unsubscribe function that cancels before event", async () => {
			const handler = vi.fn();
			const unsubscribe = eventBus.once("user.created", handler);

			unsubscribe();

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
