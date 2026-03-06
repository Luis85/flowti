import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { FlowtiUser } from "../../../src/domain/user/types";
import type { UUID } from "../../../src/utils/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

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
			await eventBus.emit("settings.changed", { settings: { ...DEFAULT_SETTINGS, debugMode: true } });

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
			await eventBus.emit("settings.changed", { settings: { ...DEFAULT_SETTINGS, debugMode: true } });

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

	describe("error boundary", () => {
		it("should catch handler errors and continue to next handler", async () => {
			const handler1 = vi.fn(() => { throw new Error("handler1 failed"); });
			const handler2 = vi.fn();
			eventBus.on("user.created", handler1);
			eventBus.on("user.created", handler2);

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(handler1).toHaveBeenCalledOnce();
			expect(handler2).toHaveBeenCalledOnce();
		});

		it("should route errors to onError callback", async () => {
			const onError = vi.fn();
			const bus = new EventBus({ onError });
			bus.on("user.created", () => { throw new Error("boom"); });

			await bus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(onError).toHaveBeenCalledWith(expect.any(Error), "user.created");
			expect((onError.mock.calls[0][0] as Error).message).toBe("boom");
		});

		it("should fall back to console.error when no onError callback", async () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			eventBus.on("user.created", () => { throw new Error("silent fail"); });

			await eventBus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(spy).toHaveBeenCalledWith(
				expect.stringContaining("user.created"),
				expect.any(Error),
			);
			spy.mockRestore();
		});

		it("should catch wildcard handler errors", async () => {
			const onError = vi.fn();
			const bus = new EventBus({ onError });
			bus.on("*", () => { throw new Error("wildcard boom"); });

			await bus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(onError).toHaveBeenCalledWith(expect.any(Error), "user.created");
		});

		it("should catch async handler rejections", async () => {
			const onError = vi.fn();
			const bus = new EventBus({ onError });
			bus.on("user.created", async () => { throw new Error("async fail"); });

			await bus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(onError).toHaveBeenCalledWith(expect.any(Error), "user.created");
		});

		it("should catch emitCustom handler errors", async () => {
			const onError = vi.fn();
			const bus = new EventBus({ onError });
			bus.on("*", () => { throw new Error("custom boom"); });

			await bus.emitCustom("my.custom.event", { data: 1 });

			expect(onError).toHaveBeenCalledWith(expect.any(Error), "my.custom.event");
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

	describe("onMeasure", () => {
		it("should call onMeasure after non-perf event dispatch", async () => {
			const onMeasure = vi.fn();
			const bus = new EventBus({ onMeasure });

			bus.on("user.created", () => {});
			await bus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			expect(onMeasure).toHaveBeenCalledOnce();
			expect(onMeasure).toHaveBeenCalledWith(
				"user.created",
				expect.any(Number),
				expect.any(Number),
			);
			const [, handlerCount, durationMs] = onMeasure.mock.calls[0];
			expect(handlerCount).toBeGreaterThanOrEqual(1);
			expect(durationMs).toBeGreaterThanOrEqual(0);
		});

		it("should skip onMeasure for perf.* events to prevent recursion", async () => {
			const onMeasure = vi.fn();
			const bus = new EventBus({ onMeasure });

			bus.on("perf.startup.total", () => {});
			await bus.emit("perf.startup.total", { durationMs: 100, serviceCount: 5 });

			expect(onMeasure).not.toHaveBeenCalled();
		});

		it("should report correct handler count including wildcard handlers", async () => {
			const onMeasure = vi.fn();
			const bus = new EventBus({ onMeasure });

			bus.on("user.created", () => {});
			bus.on("user.created", () => {});
			bus.on("*", () => {});
			await bus.emit("user.created", {
				user: { id: "id" as UUID, name: "Name", createdAt: "2024-01-01T00:00:00.000Z" },
			});

			const [, handlerCount] = onMeasure.mock.calls[0];
			expect(handlerCount).toBe(3);
		});
	});
});
