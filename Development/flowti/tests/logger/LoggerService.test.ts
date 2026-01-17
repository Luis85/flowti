import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../src/events/EventBus";
import type { IEventBus } from "../../src/events/types";
import { LoggerService } from "../../src/logger/LoggerService";

describe("LoggerService", () => {
	let logger: LoggerService;
	let eventBus: IEventBus;
	let consoleSpy: {
		log: ReturnType<typeof vi.spyOn>;
		info: ReturnType<typeof vi.spyOn>;
		warn: ReturnType<typeof vi.spyOn>;
		error: ReturnType<typeof vi.spyOn>;
	};

	beforeEach(() => {
		eventBus = new EventBus();
		logger = new LoggerService({ eventBus, debugMode: true });

		consoleSpy = {
			log: vi.spyOn(console, "log").mockImplementation(() => {}),
			info: vi.spyOn(console, "info").mockImplementation(() => {}),
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
			expect(consoleSpy.log).toHaveBeenCalledWith("[Flowti] Debug message");
		});

		it("should not log debug messages when debugMode is disabled", () => {
			const noDebugLogger = new LoggerService({ eventBus, debugMode: false });
			noDebugLogger.debug("Debug message");
			expect(consoleSpy.log).not.toHaveBeenCalled();
		});

		it("should log info messages", () => {
			logger.info("Info message");
			expect(consoleSpy.info).toHaveBeenCalledWith("[Flowti] Info message");
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
			expect(consoleSpy.info).toHaveBeenCalledWith("[Flowti] Message with data", data);
		});
	});

	describe("context", () => {
		it("should create logger with context prefix", () => {
			const contextLogger = logger.setContext("UserService");
			contextLogger.info("User created");
			expect(consoleSpy.info).toHaveBeenCalledWith("[Flowti:UserService] User created");
		});

		it("should preserve debugMode in context logger", () => {
			const noDebugLogger = new LoggerService({ eventBus, debugMode: false });
			const contextLogger = noDebugLogger.setContext("Test");
			contextLogger.debug("Should not appear");
			expect(consoleSpy.log).not.toHaveBeenCalled();
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
			expect(consoleSpy.info).toHaveBeenCalledWith("[Flowti] Standalone log");
		});
	});

	describe("setDebugMode", () => {
		it("should toggle debug mode", () => {
			const toggleLogger = new LoggerService({ eventBus, debugMode: false });

			toggleLogger.debug("Should not appear");
			expect(consoleSpy.log).not.toHaveBeenCalled();

			toggleLogger.setDebugMode(true);
			toggleLogger.debug("Should appear");
			expect(consoleSpy.log).toHaveBeenCalledWith("[Flowti] Should appear");
		});
	});
});
