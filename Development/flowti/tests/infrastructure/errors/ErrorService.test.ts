import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { LoggerService } from "../../../src/infrastructure/logger/LoggerService";
import type { ILogger } from "../../../src/infrastructure/logger/types";
import { ErrorService } from "../../../src/infrastructure/errors/ErrorService";
import { FlowtiError, ValidationError } from "../../../src/infrastructure/errors/FlowtiError";

describe("ErrorService", () => {
	let errorService: ErrorService;
	let eventBus: IEventBus;
	let logger: ILogger;

	beforeEach(() => {
		eventBus = new EventBus();
		// Suppress console output in tests
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});

		logger = new LoggerService({ eventBus, debugMode: true });
		errorService = new ErrorService({ eventBus, logger });
	});

	describe("handle", () => {
		it("should handle FlowtiError and emit event", async () => {
			const handler = vi.fn();
			eventBus.on("error.occurred", handler);

			const error = new FlowtiError({
				code: "TEST_ERROR",
				message: "Test error",
				category: "validation",
				severity: "medium",
			});

			errorService.handle(error);

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "error.occurred",
					payload: expect.objectContaining({
						code: "TEST_ERROR",
						message: "Test error",
						category: "validation",
					}),
				})
			);
		});

		it("should wrap generic Error and handle", async () => {
			const handler = vi.fn();
			eventBus.on("error.occurred", handler);

			const error = new Error("Generic error");
			errorService.handle(error, "TestContext");

			await new Promise((r) => setTimeout(r, 0));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						code: "UNKNOWN_ERROR",
						message: "Generic error",
						context: "TestContext",
					}),
				})
			);
		});

		it("should log based on severity", () => {
			const warnSpy = vi.spyOn(logger, "warn");
			const errorSpy = vi.spyOn(logger, "error");
			const infoSpy = vi.spyOn(logger, "info");

			// Medium severity -> warn
			errorService.handle(
				new FlowtiError({
					code: "MEDIUM",
					message: "Medium",
					category: "validation",
					severity: "medium",
				})
			);
			expect(warnSpy).toHaveBeenCalled();

			// High severity -> error
			errorService.handle(
				new FlowtiError({
					code: "HIGH",
					message: "High",
					category: "validation",
					severity: "high",
				})
			);
			expect(errorSpy).toHaveBeenCalled();

			// Low severity -> info
			errorService.handle(
				new FlowtiError({
					code: "LOW",
					message: "Low",
					category: "validation",
					severity: "low",
				})
			);
			expect(infoSpy).toHaveBeenCalled();
		});
	});

	describe("create", () => {
		it("should create FlowtiError from options", () => {
			const error = errorService.create({
				code: "CREATED_ERROR",
				message: "Created error",
				category: "service",
				severity: "high",
			});

			expect(error).toBeInstanceOf(FlowtiError);
			expect(error.code).toBe("CREATED_ERROR");
			expect(error.category).toBe("service");
		});
	});

	describe("wrap", () => {
		it("should return result on success", async () => {
			const result = await errorService.wrap(() => "success", {
				code: "WRAP_ERROR",
				message: "Wrap failed",
				category: "service",
			});

			expect(result).toBe("success");
		});

		it("should return async result on success", async () => {
			const result = await errorService.wrap(
				async () => {
					await new Promise((r) => setTimeout(r, 10));
					return "async success";
				},
				{
					code: "WRAP_ERROR",
					message: "Wrap failed",
					category: "service",
				}
			);

			expect(result).toBe("async success");
		});

		it("should handle error and return fallback", async () => {
			const handler = vi.fn();
			eventBus.on("error.occurred", handler);

			const result = await errorService.wrap(
				() => {
					throw new Error("Operation failed");
				},
				{
					code: "WRAP_ERROR",
					message: "Wrapped operation failed",
					category: "service",
					fallback: "fallback value",
				}
			);

			expect(result).toBe("fallback value");

			await new Promise((r) => setTimeout(r, 0));
			expect(handler).toHaveBeenCalledOnce();
		});

		it("should rethrow when rethrow option is true", async () => {
			await expect(
				errorService.wrap(
					() => {
						throw new Error("Operation failed");
					},
					{
						code: "WRAP_ERROR",
						message: "Wrapped operation failed",
						category: "service",
						rethrow: true,
					}
				)
			).rejects.toThrow(FlowtiError);
		});

		it("should preserve original error as cause", async () => {
			const originalError = new ValidationError({
				code: "ORIGINAL",
				message: "Original validation error",
			});

			try {
				await errorService.wrap(
					() => {
						throw originalError;
					},
					{
						code: "WRAP_ERROR",
						message: "Wrapped",
						category: "service",
						rethrow: true,
					}
				);
			} catch (error) {
				expect(error).toBeInstanceOf(FlowtiError);
				expect((error as FlowtiError).cause).toBe(originalError);
			}
		});
	});

	describe("without dependencies", () => {
		it("should work without eventBus", () => {
			const standaloneService = new ErrorService({ logger });

			// Should not throw
			standaloneService.handle(
				new FlowtiError({
					code: "TEST",
					message: "Test",
					category: "validation",
				})
			);
		});

		it("should work without logger", async () => {
			const standaloneService = new ErrorService({ eventBus });
			const handler = vi.fn();
			eventBus.on("error.occurred", handler);

			standaloneService.handle(
				new FlowtiError({
					code: "TEST",
					message: "Test",
					category: "validation",
				})
			);

			await new Promise((r) => setTimeout(r, 0));
			expect(handler).toHaveBeenCalledOnce();
		});
	});
});
