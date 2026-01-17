import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/events/EventBus";
import type { IEventBus } from "../../src/events/types";
import { LoggerService } from "../../src/logger/LoggerService";
import type { ILogger } from "../../src/logger/types";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import { ServiceError } from "../../src/errors/FlowtiError";
import type { IDisposable } from "../../src/services/types";

describe("ServiceContainer", () => {
	let container: ServiceContainer;
	let eventBus: IEventBus;
	let logger: ILogger;

	beforeEach(() => {
		eventBus = new EventBus();
		// Suppress console output
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});

		logger = new LoggerService({ eventBus, debugMode: true });
		container = new ServiceContainer({ eventBus, logger });
	});

	describe("register", () => {
		it("should register a service", () => {
			container.register({
				id: "testService",
				factory: () => ({ name: "test" }),
			});

			expect(container.has("testService")).toBe(true);
		});

		it("should throw when registering duplicate ID", () => {
			container.register({
				id: "duplicate",
				factory: () => ({}),
			});

			expect(() =>
				container.register({
					id: "duplicate",
					factory: () => ({}),
				})
			).toThrow(ServiceError);
		});
	});

	describe("get", () => {
		it("should create and return service instance", async () => {
			const factory = vi.fn(() => ({ value: 42 }));

			container.register({
				id: "myService",
				factory,
			});

			const service = await container.get<{ value: number }>("myService");

			expect(service.value).toBe(42);
			expect(factory).toHaveBeenCalledOnce();
		});

		it("should return same instance for singleton (default)", async () => {
			let counter = 0;
			container.register({
				id: "singleton",
				factory: () => ({ id: ++counter }),
			});

			const first = await container.get<{ id: number }>("singleton");
			const second = await container.get<{ id: number }>("singleton");

			expect(first).toBe(second);
			expect(first.id).toBe(1);
		});

		it("should create new instance for transient", async () => {
			let counter = 0;
			container.register({
				id: "transient",
				lifecycle: "transient",
				factory: () => ({ id: ++counter }),
			});

			const first = await container.get<{ id: number }>("transient");
			const second = await container.get<{ id: number }>("transient");

			expect(first).not.toBe(second);
			expect(first.id).toBe(1);
			expect(second.id).toBe(2);
		});

		it("should throw when service not found", async () => {
			await expect(container.get("nonexistent")).rejects.toThrow(
				ServiceError
			);
			await expect(container.get("nonexistent")).rejects.toThrow(
				"not registered"
			);
		});

		it("should support async factory", async () => {
			container.register({
				id: "asyncService",
				factory: async () => {
					await new Promise((r) => setTimeout(r, 10));
					return { async: true };
				},
			});

			const service = await container.get<{ async: boolean }>(
				"asyncService"
			);

			expect(service.async).toBe(true);
		});

		it("should pass container to factory", async () => {
			const factorySpy = vi.fn((c) => ({
				hasEventBus: !!c.getEventBus(),
				hasLogger: !!c.getLogger(),
			}));

			container.register({
				id: "containerAware",
				factory: factorySpy,
			});

			const service = await container.get<{
				hasEventBus: boolean;
				hasLogger: boolean;
			}>("containerAware");

			expect(service.hasEventBus).toBe(true);
			expect(service.hasLogger).toBe(true);
			expect(factorySpy).toHaveBeenCalledWith(container);
		});
	});

	describe("dependencies", () => {
		it("should resolve dependencies in order", async () => {
			const order: string[] = [];

			container.register({
				id: "serviceA",
				factory: () => {
					order.push("A");
					return { name: "A" };
				},
			});

			container.register({
				id: "serviceB",
				dependencies: ["serviceA"],
				factory: async (c) => {
					const a = await c.get<{ name: string }>("serviceA");
					order.push("B");
					return { name: "B", dep: a.name };
				},
			});

			const serviceB = await container.get<{ name: string; dep: string }>(
				"serviceB"
			);

			expect(order).toEqual(["A", "B"]);
			expect(serviceB.dep).toBe("A");
		});

		it("should detect circular dependencies", async () => {
			container.register({
				id: "circularA",
				dependencies: ["circularB"],
				factory: async (c) => {
					await c.get("circularB");
					return {};
				},
			});

			container.register({
				id: "circularB",
				dependencies: ["circularA"],
				factory: async (c) => {
					await c.get("circularA");
					return {};
				},
			});

			await expect(container.get("circularA")).rejects.toThrow(
				"Circular dependency"
			);
		});
	});

	describe("getEventBus / getLogger", () => {
		it("should return event bus", () => {
			expect(container.getEventBus()).toBe(eventBus);
		});

		it("should return logger", () => {
			expect(container.getLogger()).toBe(logger);
		});
	});

	describe("initializeAll", () => {
		it("should initialize all singleton services", async () => {
			const factoryA = vi.fn(() => ({ name: "A" }));
			const factoryB = vi.fn(() => ({ name: "B" }));

			container.register({ id: "initA", factory: factoryA });
			container.register({ id: "initB", factory: factoryB });
			container.register({
				id: "transientC",
				lifecycle: "transient",
				factory: vi.fn(),
			});

			await container.initializeAll();

			expect(factoryA).toHaveBeenCalledOnce();
			expect(factoryB).toHaveBeenCalledOnce();
		});

		it("should initialize in dependency order", async () => {
			const order: string[] = [];

			container.register({
				id: "dep1",
				factory: () => {
					order.push("dep1");
					return {};
				},
			});

			container.register({
				id: "dep2",
				dependencies: ["dep1"],
				factory: () => {
					order.push("dep2");
					return {};
				},
			});

			container.register({
				id: "dep3",
				dependencies: ["dep2"],
				factory: () => {
					order.push("dep3");
					return {};
				},
			});

			await container.initializeAll();

			expect(order).toEqual(["dep1", "dep2", "dep3"]);
		});
	});

	describe("disposeAll", () => {
		it("should dispose all disposable services", async () => {
			const disposeSpy = vi.fn();

			class DisposableService implements IDisposable {
				dispose() {
					disposeSpy();
				}
			}

			container.register({
				id: "disposable",
				factory: () => new DisposableService(),
			});

			await container.initializeAll();
			await container.disposeAll();

			expect(disposeSpy).toHaveBeenCalledOnce();
		});

		it("should not throw for non-disposable services", async () => {
			container.register({
				id: "nonDisposable",
				factory: () => ({ value: 1 }),
			});

			await container.initializeAll();

			// Should not throw
			await expect(container.disposeAll()).resolves.not.toThrow();
		});

		it("should clear instances after disposal", async () => {
			const factory = vi.fn(() => ({ value: 1 }));

			container.register({
				id: "clearable",
				factory,
			});

			await container.get("clearable");
			expect(factory).toHaveBeenCalledTimes(1);

			await container.disposeAll();

			// After disposal, getting service should create new instance
			await container.get("clearable");
			expect(factory).toHaveBeenCalledTimes(2);
		});

		it("should dispose in reverse order", async () => {
			const order: string[] = [];

			class OrderedDisposable implements IDisposable {
				constructor(private name: string) {}
				dispose() {
					order.push(this.name);
				}
			}

			container.register({
				id: "first",
				factory: () => new OrderedDisposable("first"),
			});

			container.register({
				id: "second",
				dependencies: ["first"],
				factory: () => new OrderedDisposable("second"),
			});

			container.register({
				id: "third",
				dependencies: ["second"],
				factory: () => new OrderedDisposable("third"),
			});

			await container.initializeAll();
			await container.disposeAll();

			expect(order).toEqual(["third", "second", "first"]);
		});
	});

	describe("has", () => {
		it("should return true for registered service", () => {
			container.register({
				id: "registered",
				factory: () => ({}),
			});

			expect(container.has("registered")).toBe(true);
		});

		it("should return false for unregistered service", () => {
			expect(container.has("unregistered")).toBe(false);
		});
	});

	describe("event emission", () => {
		it("should emit service.registered event when registering", async () => {
			const handler = vi.fn();
			eventBus.on("service.registered", handler);

			container.register({
				id: "eventTest",
				factory: () => ({ value: 1 }),
			});

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "service.registered",
					payload: { serviceId: "eventTest" },
				})
			);
		});

		it("should emit service.initialized event when service is created", async () => {
			const handler = vi.fn();
			eventBus.on("service.initialized", handler);

			container.register({
				id: "initEvent",
				factory: () => ({ value: 1 }),
			});

			await container.get("initEvent");

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "service.initialized",
					payload: { serviceId: "initEvent" },
				})
			);
		});

		it("should emit service.error event when initialization fails", async () => {
			const handler = vi.fn();
			eventBus.on("service.error", handler);

			container.register({
				id: "failingService",
				factory: () => {
					throw new Error("Init failed");
				},
			});

			await expect(container.get("failingService")).rejects.toThrow();

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "service.error",
					payload: expect.objectContaining({
						serviceId: "failingService",
						error: expect.objectContaining({
							message: "Init failed",
						}),
					}),
				})
			);
		});

		it("should emit service.disposed event when disposing", async () => {
			const handler = vi.fn();
			eventBus.on("service.disposed", handler);

			container.register({
				id: "disposableEvent",
				factory: () => ({
					dispose: vi.fn(),
				}),
			});

			await container.initializeAll();
			await container.disposeAll();

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "service.disposed",
					payload: { serviceId: "disposableEvent" },
				})
			);
		});
	});
});
