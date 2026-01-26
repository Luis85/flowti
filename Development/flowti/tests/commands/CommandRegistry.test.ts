import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/events/EventBus";
import type { IEventBus } from "../../src/events/types";
import { LoggerService } from "../../src/logger/LoggerService";
import type { ILogger } from "../../src/logger/types";
import type { IServiceContainer } from "../../src/services/types";
import {
	CommandRegistry,
	createLoggingMiddleware,
	createErrorMiddleware,
} from "../../src/commands/CommandRegistry";
import { CommandError } from "../../src/errors/FlowtiError";
import type { CommandContext, CommandDefinition } from "../../src/commands/types";

describe("CommandRegistry", () => {
	let registry: CommandRegistry;
	let eventBus: IEventBus;
	let logger: ILogger;
	let ctx: CommandContext;

	beforeEach(() => {
		eventBus = new EventBus();
		// Suppress console output
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});

		logger = new LoggerService({ eventBus, debugMode: true });
		registry = new CommandRegistry({ logger, eventBus });

		ctx = {
			app: {} as CommandContext["app"],
			eventBus,
			logger,
			services: {} as IServiceContainer,
		};
	});

	describe("register", () => {
		it("should register a command", () => {
			const command: CommandDefinition = {
				id: "test:command",
				name: "Test Command",
				handler: vi.fn(),
			};

			registry.register(command);

			expect(registry.getCommand("test:command")).toBe(command);
			expect(registry.getCommands()).toContain(command);
		});

		it("should throw when registering duplicate ID", () => {
			const command: CommandDefinition = {
				id: "test:duplicate",
				name: "Test",
				handler: vi.fn(),
			};

			registry.register(command);

			expect(() => registry.register(command)).toThrow(CommandError);
			expect(() => registry.register(command)).toThrow(
				"already registered"
			);
		});
	});

	describe("registerMany", () => {
		it("should register multiple commands", () => {
			const commands: CommandDefinition[] = [
				{ id: "cmd:one", name: "One", handler: vi.fn() },
				{ id: "cmd:two", name: "Two", handler: vi.fn() },
				{ id: "cmd:three", name: "Three", handler: vi.fn() },
			];

			registry.registerMany(commands);

			expect(registry.getCommands()).toHaveLength(3);
			expect(registry.getCommand("cmd:one")).toBeDefined();
			expect(registry.getCommand("cmd:two")).toBeDefined();
			expect(registry.getCommand("cmd:three")).toBeDefined();
		});
	});

	describe("execute", () => {
		it("should execute command handler", async () => {
			const handler = vi.fn();
			registry.register({
				id: "test:execute",
				name: "Execute Test",
				handler,
			});

			await registry.execute("test:execute", ctx);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(ctx);
		});

		it("should throw when command not found", async () => {
			await expect(registry.execute("nonexistent", ctx)).rejects.toThrow(
				CommandError
			);
			await expect(registry.execute("nonexistent", ctx)).rejects.toThrow(
				"not found"
			);
		});

		it("should support async handlers", async () => {
			const handler = vi.fn(async () => {
				await new Promise((r) => setTimeout(r, 10));
			});

			registry.register({
				id: "test:async",
				name: "Async Test",
				handler,
			});

			await registry.execute("test:async", ctx);

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	describe("middleware", () => {
		it("should execute middleware before handler", async () => {
			const order: string[] = [];

			registry.use(async (cmd, ctx, next) => {
				order.push("middleware:before");
				await next();
				order.push("middleware:after");
			});

			registry.register({
				id: "test:middleware",
				name: "Middleware Test",
				handler: () => {
					order.push("handler");
				},
			});

			await registry.execute("test:middleware", ctx);

			expect(order).toEqual([
				"middleware:before",
				"handler",
				"middleware:after",
			]);
		});

		it("should execute multiple middlewares in order", async () => {
			const order: string[] = [];

			registry.use(async (cmd, ctx, next) => {
				order.push("first:before");
				await next();
				order.push("first:after");
			});

			registry.use(async (cmd, ctx, next) => {
				order.push("second:before");
				await next();
				order.push("second:after");
			});

			registry.register({
				id: "test:multi-middleware",
				name: "Multi Middleware Test",
				handler: () => {
					order.push("handler");
				},
			});

			await registry.execute("test:multi-middleware", ctx);

			expect(order).toEqual([
				"first:before",
				"second:before",
				"handler",
				"second:after",
				"first:after",
			]);
		});

		it("should allow middleware to access command info", async () => {
			const middlewareSpy = vi.fn();

			registry.use(async (cmd, ctx, next) => {
				middlewareSpy(cmd.id, cmd.name);
				await next();
			});

			registry.register({
				id: "test:cmd-info",
				name: "Command Info Test",
				handler: vi.fn(),
			});

			await registry.execute("test:cmd-info", ctx);

			expect(middlewareSpy).toHaveBeenCalledWith(
				"test:cmd-info",
				"Command Info Test"
			);
		});
	});

	describe("clear", () => {
		it("should clear all commands", () => {
			registry.register({ id: "cmd:one", name: "One", handler: vi.fn() });
			registry.register({ id: "cmd:two", name: "Two", handler: vi.fn() });

			registry.clear();

			expect(registry.getCommands()).toHaveLength(0);
			expect(registry.getCommand("cmd:one")).toBeUndefined();
		});
	});

	describe("createLoggingMiddleware", () => {
		it("should log command execution", async () => {
			const debugSpy = vi.spyOn(logger, "debug");

			registry.use(createLoggingMiddleware());
			registry.register({
				id: "test:logging",
				name: "Logging Test",
				handler: vi.fn(),
			});

			await registry.execute("test:logging", ctx);

			expect(debugSpy).toHaveBeenCalledWith(
				expect.stringContaining("Executing command")
			);
			expect(debugSpy).toHaveBeenCalledWith(
				expect.stringContaining("Command completed")
			);
		});

		it("should log errors", async () => {
			const errorSpy = vi.spyOn(logger, "error");

			registry.use(createLoggingMiddleware());
			registry.register({
				id: "test:error-log",
				name: "Error Log Test",
				handler: () => {
					throw new Error("Handler failed");
				},
			});

			await expect(
				registry.execute("test:error-log", ctx)
			).rejects.toThrow();

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Command failed"),
				expect.any(String)
			);
		});
	});

	describe("createErrorMiddleware", () => {
		it("should wrap errors in CommandError", async () => {
			registry.use(createErrorMiddleware());
			registry.register({
				id: "test:error-wrap",
				name: "Error Wrap Test",
				handler: () => {
					throw new Error("Original error");
				},
			});

			await expect(
				registry.execute("test:error-wrap", ctx)
			).rejects.toThrow(CommandError);
		});

		it("should call onError callback", async () => {
			const onError = vi.fn();

			registry.use(createErrorMiddleware(onError));
			registry.register({
				id: "test:on-error",
				name: "OnError Test",
				handler: () => {
					throw new Error("Handler error");
				},
			});

			await expect(registry.execute("test:on-error", ctx)).rejects.toThrow();

			expect(onError).toHaveBeenCalledOnce();
			expect(onError).toHaveBeenCalledWith(
				expect.any(CommandError),
				expect.objectContaining({ id: "test:on-error" })
			);
		});
	});

	describe("event emission", () => {
		it("should emit command.registered event when registering", async () => {
			const handler = vi.fn();
			eventBus.on("command.registered", handler);

			registry.register({
				id: "test:event-register",
				name: "Event Register Test",
				handler: vi.fn(),
			});

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "command.registered",
					payload: {
						commandId: "test:event-register",
						commandName: "Event Register Test",
					},
				})
			);
		});

		it("should emit command.executing event when starting execution", async () => {
			const handler = vi.fn();
			eventBus.on("command.executing", handler);

			registry.register({
				id: "test:event-executing",
				name: "Event Executing Test",
				handler: vi.fn(),
			});

			await registry.execute("test:event-executing", ctx);

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "command.executing",
					payload: { commandId: "test:event-executing" },
				})
			);
		});

		it("should emit command.executed event on successful execution", async () => {
			const handler = vi.fn();
			eventBus.on("command.executed", handler);

			registry.register({
				id: "test:event-executed",
				name: "Event Executed Test",
				handler: vi.fn(),
			});

			await registry.execute("test:event-executed", ctx);

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "command.executed",
					payload: expect.objectContaining({
						commandId: "test:event-executed",
						durationMs: expect.any(Number),
					}),
				})
			);
		});

		it("should emit command.failed event on error", async () => {
			const handler = vi.fn();
			eventBus.on("command.failed", handler);

			registry.register({
				id: "test:event-failed",
				name: "Event Failed Test",
				handler: () => {
					throw new Error("Command failed");
				},
			});

			await expect(
				registry.execute("test:event-failed", ctx)
			).rejects.toThrow();

			// Allow event to be emitted
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "command.failed",
					payload: expect.objectContaining({
						commandId: "test:event-failed",
						error: expect.objectContaining({
							message: "Command failed",
						}),
					}),
				})
			);
		});
	});
});
