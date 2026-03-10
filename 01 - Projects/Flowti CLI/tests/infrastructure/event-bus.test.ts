import { describe, it, expect, vi } from "vitest";
import { createCliBus } from "../../src/infrastructure/event-bus.js";

describe("createCliBus", () => {
	it("returns a bus with emit, on, once, clear", () => {
		const bus = createCliBus();
		expect(typeof bus.emit).toBe("function");
		expect(typeof bus.on).toBe("function");
		expect(typeof bus.once).toBe("function");
		expect(typeof bus.clear).toBe("function");
	});
});

describe("emit / on", () => {
	it("delivers payload to registered handler", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		bus.on("cli.progress", handler);
		bus.emit("cli.progress", { message: "hello" });
		expect(handler).toHaveBeenCalledWith({
			type: "cli.progress",
			payload: { message: "hello" },
		});
	});

	it("delivers to multiple handlers in registration order", () => {
		const bus = createCliBus();
		const order: number[] = [];
		bus.on("cli.progress", () => order.push(1));
		bus.on("cli.progress", () => order.push(2));
		bus.emit("cli.progress", { message: "x" });
		expect(order).toEqual([1, 2]);
	});

	it("does not deliver to handlers for other event types", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		bus.on("cli.warn", handler);
		bus.emit("cli.progress", { message: "x" });
		expect(handler).not.toHaveBeenCalled();
	});

	it("does nothing when no handlers are registered", () => {
		const bus = createCliBus();
		expect(() => bus.emit("cli.progress", { message: "x" })).not.toThrow();
	});
});

describe("unsubscribe", () => {
	it("on() returns an unsubscribe function", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		const unsub = bus.on("cli.progress", handler);
		unsub();
		bus.emit("cli.progress", { message: "x" });
		expect(handler).not.toHaveBeenCalled();
	});

	it("unsubscribe is idempotent", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		const unsub = bus.on("cli.progress", handler);
		unsub();
		unsub(); // second call is safe
		bus.emit("cli.progress", { message: "x" });
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("once", () => {
	it("fires handler exactly once", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		bus.once("cli.progress", handler);
		bus.emit("cli.progress", { message: "first" });
		bus.emit("cli.progress", { message: "second" });
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			type: "cli.progress",
			payload: { message: "first" },
		});
	});

	it("once returns an unsubscribe function that prevents firing", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		const unsub = bus.once("cli.progress", handler);
		unsub();
		bus.emit("cli.progress", { message: "x" });
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("clear", () => {
	it("removes all handlers", () => {
		const bus = createCliBus();
		const h1 = vi.fn();
		const h2 = vi.fn();
		bus.on("cli.progress", h1);
		bus.on("cli.warn", h2);
		bus.clear();
		bus.emit("cli.progress", { message: "x" });
		bus.emit("cli.warn", { message: "y" });
		expect(h1).not.toHaveBeenCalled();
		expect(h2).not.toHaveBeenCalled();
	});
});

describe("error isolation", () => {
	it("swallows handler errors and continues to next handler", () => {
		const bus = createCliBus();
		const good = vi.fn();
		bus.on("cli.progress", () => { throw new Error("boom"); });
		bus.on("cli.progress", good);
		bus.emit("cli.progress", { message: "x" });
		expect(good).toHaveBeenCalled();
	});
});

describe("typed events", () => {
	it("handles report events", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		bus.on("report.progress", handler);
		bus.emit("report.progress", { generator: "test", message: "running" });
		expect(handler).toHaveBeenCalledWith({
			type: "report.progress",
			payload: { generator: "test", message: "running" },
		});
	});

	it("handles e2e events", () => {
		const bus = createCliBus();
		const handler = vi.fn();
		bus.on("e2e.step.progress", handler);
		bus.emit("e2e.step.progress", { level: "ok", message: "passed" });
		expect(handler).toHaveBeenCalledWith({
			type: "e2e.step.progress",
			payload: { level: "ok", message: "passed" },
		});
	});
});
