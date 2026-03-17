import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { LoggerService } from "../../../src/infrastructure/logger/LoggerService";

describe("LoggerService", () => {
	let logger: LoggerService;
	let eventBus: IEventBus;
	let consoleSpy: {
		debug: ReturnType<typeof vi.spyOn>;
		warn: ReturnType<typeof vi.spyOn>;
		error: ReturnType<typeof vi.spyOn>;
	};

	beforeEach(() => {
		eventBus = new EventBus();
		logger = new LoggerService({ eventBus, debugMode: true });

		consoleSpy = {
			debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
			warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
			error: vi.spyOn(console, "error").mockImplementation(() => {}),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("log levels", () => {
		it("should log debug messages when debugMode is enabled", () => {
			logger.debug("Debug message");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] Debug message");
		});

		it("should not log debug messages when debugMode is disabled", () => {
			const noDebugLogger = new LoggerService({ eventBus, debugMode: false });
			noDebugLogger.debug("Debug message");
			expect(consoleSpy.debug).not.toHaveBeenCalledWith("[Flowti] Debug message");
		});

		it("should log info messages", () => {
			logger.info("Info message");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] Info message");
		});

		it("should log warn messages", () => {
			logger.warn("Warn message");
			expect(consoleSpy.warn).toHaveBeenCalledWith("[Flowti] Warn message");
		});

		it("should log error messages", () => {
			logger.error("Error message");
			expect(consoleSpy.error).toHaveBeenCalledWith("[Flowti] Error message");
		});

		it("should include data when provided", () => {
			const data = { key: "value" };
			logger.info("Message with data", data);
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] Message with data", data);
		});
	});

	describe("context", () => {
		it("should create logger with context prefix", () => {
			const contextLogger = logger.setContext("UserService");
			contextLogger.info("User created");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti:UserService] User created");
		});

		it("should preserve debugMode in context logger", () => {
			const noDebugLogger = new LoggerService({ eventBus, debugMode: false });
			const contextLogger = noDebugLogger.setContext("Test");
			contextLogger.debug("Should not appear");
			expect(consoleSpy.debug).not.toHaveBeenCalledWith("[Flowti:Test] Should not appear");
		});
	});

	describe("event emission", () => {
		it("should emit log.entry event for each log", async () => {
			const handler = vi.fn();
			eventBus.on("log.entry", handler);

			logger.info("Test message");

			// Give time for async event emission
			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "log.entry",
					payload: expect.objectContaining({
						level: "info",
						message: "Test message",
					}),
				})
			);
		});

		it("should emit log.error event for error logs", async () => {
			const entryHandler = vi.fn();
			const errorHandler = vi.fn();
			eventBus.on("log.entry", entryHandler);
			eventBus.on("log.error", errorHandler);

			logger.error("Error occurred");

			await new Promise((r) => setTimeout(r, 0));

			expect(entryHandler).toHaveBeenCalledOnce();
			expect(errorHandler).toHaveBeenCalledOnce();
			expect(errorHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "log.error",
					payload: expect.objectContaining({
						level: "error",
						message: "Error occurred",
					}),
				})
			);
		});

		it("should not emit log.error for non-error logs", async () => {
			const errorHandler = vi.fn();
			eventBus.on("log.error", errorHandler);

			logger.info("Info message");
			logger.warn("Warn message");

			await new Promise((r) => setTimeout(r, 0));

			expect(errorHandler).not.toHaveBeenCalled();
		});
	});

	describe("without eventBus", () => {
		it("should work without eventBus", () => {
			const standaloneLogger = new LoggerService({ debugMode: true });
			standaloneLogger.info("Standalone log");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] Standalone log");
		});
	});

	describe("setDebugMode", () => {
		it("should toggle debug mode", () => {
			const toggleLogger = new LoggerService({ eventBus, debugMode: false });

			toggleLogger.debug("Should not appear");
			expect(consoleSpy.debug).not.toHaveBeenCalledWith("[Flowti] Should not appear");

			toggleLogger.setDebugMode(true);
			toggleLogger.debug("Should appear");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] Should appear");
		});
	});

	describe("event trace", () => {
		it("should log all non-log events to console when debugMode is on", async () => {
			await eventBus.emit("plugin.loaded", { timestamp: "2026-01-01" });

			expect(consoleSpy.debug).toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				"plugin.loaded",
				{ timestamp: "2026-01-01" }
			);
		});

		it("should skip log.* events to avoid recursion", async () => {
			consoleSpy.debug.mockClear();

			await eventBus.emit("log.entry", {
				level: "info",
				message: "test",
				timestamp: "2026-01-01",
			});

			// Only the debug() call from logger itself should hit console.log,
			// not the wildcard trace
			expect(consoleSpy.debug).not.toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				"log.entry",
				expect.anything()
			);
		});

		it("should not trace events when debugMode is off", async () => {
			const isolatedBus = new EventBus();
			new LoggerService({ eventBus: isolatedBus, debugMode: false });
			consoleSpy.debug.mockClear();

			await isolatedBus.emit("plugin.loaded", { timestamp: "2026-01-01" });

			expect(consoleSpy.debug).not.toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				expect.anything(),
				expect.anything()
			);
		});

		it("should start tracing when setDebugMode(true) is called", async () => {
			const isolatedBus = new EventBus();
			const toggleLogger = new LoggerService({ eventBus: isolatedBus, debugMode: false });
			consoleSpy.debug.mockClear();

			await isolatedBus.emit("plugin.loaded", { timestamp: "t1" });
			expect(consoleSpy.debug).not.toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				"plugin.loaded",
				expect.anything()
			);

			toggleLogger.setDebugMode(true);
			await isolatedBus.emit("plugin.ready", { timestamp: "t2" });

			expect(consoleSpy.debug).toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				"plugin.ready",
				{ timestamp: "t2" }
			);
		});

		it("should stop tracing when setDebugMode(false) is called", async () => {
			// logger starts with debugMode: true (from beforeEach)
			await eventBus.emit("plugin.loaded", { timestamp: "t1" });
			expect(consoleSpy.debug).toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				"plugin.loaded",
				{ timestamp: "t1" }
			);

			consoleSpy.debug.mockClear();
			logger.setDebugMode(false);

			await eventBus.emit("plugin.ready", { timestamp: "t2" });
			expect(consoleSpy.debug).not.toHaveBeenCalledWith(
				"[Flowti:EventTrace]",
				expect.anything(),
				expect.anything()
			);
		});

		it("should not trace without eventBus", () => {
			const standalone = new LoggerService({ debugMode: true });
			// Should not throw
			standalone.info("works fine");
			expect(consoleSpy.debug).toHaveBeenCalledWith("[Flowti] works fine");
		});
	});
});
