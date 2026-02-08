import { describe, it, expect } from "vitest";
import {
	FlowtiError,
	ValidationError,
	StorageError,
	LifecycleError,
	ServiceError,
	CommandError,
} from "../../../src/infrastructure/errors/FlowtiError";

describe("FlowtiError", () => {
	describe("constructor", () => {
		it("should create error with required properties", () => {
			const error = new FlowtiError({
				code: "TEST_ERROR",
				message: "Test error message",
				category: "validation",
			});

			expect(error.code).toBe("TEST_ERROR");
			expect(error.message).toBe("Test error message");
			expect(error.category).toBe("validation");
			expect(error.severity).toBe("medium"); // default
			expect(error.name).toBe("FlowtiError");
			expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it("should accept optional properties", () => {
			const error = new FlowtiError({
				code: "TEST_ERROR",
				message: "Test message",
				category: "storage",
				severity: "critical",
				context: "TestService",
				details: { key: "value" },
			});

			expect(error.severity).toBe("critical");
			expect(error.context).toBe("TestService");
			expect(error.details).toEqual({ key: "value" });
		});

		it("should preserve cause error", () => {
			const cause = new Error("Original error");
			const error = new FlowtiError({
				code: "WRAPPED_ERROR",
				message: "Wrapped error",
				category: "unknown",
				cause,
			});

			expect(error.cause).toBe(cause);
			expect(error.stack).toContain("Caused by:");
		});

		it("should be instanceof Error", () => {
			const error = new FlowtiError({
				code: "TEST",
				message: "Test",
				category: "validation",
			});

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(FlowtiError);
		});
	});

	describe("toInfo", () => {
		it("should convert to FlowtiErrorInfo", () => {
			const cause = new Error("Cause");
			const error = new FlowtiError({
				code: "INFO_TEST",
				message: "Info test message",
				category: "service",
				severity: "high",
				context: "TestContext",
				details: { foo: "bar" },
				cause,
			});

			const info = error.toInfo();

			expect(info.code).toBe("INFO_TEST");
			expect(info.message).toBe("Info test message");
			expect(info.category).toBe("service");
			expect(info.severity).toBe("high");
			expect(info.context).toBe("TestContext");
			expect(info.details).toEqual({ foo: "bar" });
			expect(info.cause).toBe(cause);
			expect(info.timestamp).toBe(error.timestamp);
		});
	});

	describe("fromError", () => {
		it("should return same instance if already FlowtiError", () => {
			const original = new FlowtiError({
				code: "ORIGINAL",
				message: "Original",
				category: "validation",
			});

			const result = FlowtiError.fromError(original);

			expect(result).toBe(original);
		});

		it("should wrap generic Error", () => {
			const original = new Error("Generic error");
			const result = FlowtiError.fromError(original);

			expect(result).toBeInstanceOf(FlowtiError);
			expect(result.message).toBe("Generic error");
			expect(result.code).toBe("UNKNOWN_ERROR");
			expect(result.category).toBe("unknown");
			expect(result.cause).toBe(original);
		});

		it("should accept override options", () => {
			const original = new Error("Original message");
			const result = FlowtiError.fromError(original, {
				code: "CUSTOM_CODE",
				message: "Custom message",
				category: "storage",
				severity: "critical",
				context: "CustomContext",
			});

			expect(result.code).toBe("CUSTOM_CODE");
			expect(result.message).toBe("Custom message");
			expect(result.category).toBe("storage");
			expect(result.severity).toBe("critical");
			expect(result.context).toBe("CustomContext");
		});
	});
});

describe("Specialized Error Classes", () => {
	it("should create ValidationError with correct category", () => {
		const error = new ValidationError({
			code: "INVALID_INPUT",
			message: "Invalid input",
		});

		expect(error.name).toBe("ValidationError");
		expect(error.category).toBe("validation");
		expect(error).toBeInstanceOf(FlowtiError);
		expect(error).toBeInstanceOf(ValidationError);
	});

	it("should create StorageError with correct category", () => {
		const error = new StorageError({
			code: "STORAGE_FAILED",
			message: "Storage failed",
		});

		expect(error.name).toBe("StorageError");
		expect(error.category).toBe("storage");
		expect(error).toBeInstanceOf(StorageError);
	});

	it("should create LifecycleError with correct category", () => {
		const error = new LifecycleError({
			code: "INIT_FAILED",
			message: "Initialization failed",
		});

		expect(error.name).toBe("LifecycleError");
		expect(error.category).toBe("lifecycle");
		expect(error).toBeInstanceOf(LifecycleError);
	});

	it("should create ServiceError with correct category", () => {
		const error = new ServiceError({
			code: "SERVICE_UNAVAILABLE",
			message: "Service unavailable",
		});

		expect(error.name).toBe("ServiceError");
		expect(error.category).toBe("service");
		expect(error).toBeInstanceOf(ServiceError);
	});

	it("should create CommandError with correct category", () => {
		const error = new CommandError({
			code: "COMMAND_FAILED",
			message: "Command failed",
		});

		expect(error.name).toBe("CommandError");
		expect(error.category).toBe("command");
		expect(error).toBeInstanceOf(CommandError);
	});
});
