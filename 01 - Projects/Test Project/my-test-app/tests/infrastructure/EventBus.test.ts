import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";

describe("EventBus", () => {
	let bus: IEventBus;

	beforeEach(() => {
		bus = new EventBus();
	});

	it("should emit to a registered handler", async () => {
		let called = false;
		bus.on("app.loaded", () => { called = true; });

		await bus.emit("app.loaded", {});

		expect(called).toBe(true);
	});

	it("should pass the correct payload", async () => {
		let receivedType = "";
		bus.on("app.loaded", (event) => { receivedType = event.type; });

		await bus.emit("app.loaded", {});

		expect(receivedType).toBe("app.loaded");
	});

	it("should unsubscribe when calling the returned function", async () => {
		let callCount = 0;
		const unsub = bus.on("app.loaded", () => { callCount++; });

		await bus.emit("app.loaded", {});
		unsub();
		await bus.emit("app.loaded", {});

		expect(callCount).toBe(1);
	});

	it("should remove all handlers on clear()", async () => {
		let callCount = 0;
		bus.on("app.loaded", () => { callCount++; });
		bus.on("app.unloaded", () => { callCount++; });

		bus.clear();
		await bus.emit("app.loaded", {});
		await bus.emit("app.unloaded", {});

		expect(callCount).toBe(0);
	});
});
