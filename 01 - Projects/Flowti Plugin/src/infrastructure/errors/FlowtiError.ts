import type {
	ErrorCategory,
	ErrorSeverity,
	FlowtiErrorInfo,
	CreateErrorOptions,
} from "./types";

/**
 * Base error class for all Flowti errors.
 *
 * Provides structured error information including category, severity,
 * and context for consistent error handling across the application.
 *
 * @example Basic usage
 * ```typescript
 * throw new FlowtiError({
 *   code: "USER_NOT_FOUND",
 *   message: "User does not exist",
 *   category: "validation",
 *   severity: "medium",
 *   context: "UserService",
 * });
 * ```
 *
 * @example Wrapping another error
 * ```typescript
 * try {
 *   await storage.load();
 * } catch (error) {
 *   throw new FlowtiError({
 *     code: "STORAGE_LOAD_FAILED",
 *     message: "Failed to load data from storage",
 *     category: "storage",
 *     severity: "high",
 *     cause: error instanceof Error ? error : undefined,
 *   });
 * }
 * ```
 */
export class FlowtiError extends Error {
	readonly code: string;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly context?: string;
	readonly details?: unknown;
	readonly timestamp: string;
	declare readonly cause?: Error;

	constructor(options: CreateErrorOptions) {
		super(options.message);
		this.name = "FlowtiError";
		this.code = options.code;
		this.category = options.category;
		this.severity = options.severity ?? "medium";
		this.context = options.context;
		this.details = options.details;
		this.timestamp = new Date().toISOString();

		// Preserve the original error's stack if available
		if (options.cause) {
			this.cause = options.cause;
			if (options.cause.stack) {
				this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
			}
		}

		// Ensure proper prototype chain for instanceof checks
		Object.setPrototypeOf(this, FlowtiError.prototype);
	}

	/**
	 * Converts the error to a structured info object for logging/events.
	 */
	toInfo(): FlowtiErrorInfo {
		return {
			code: this.code,
			message: this.message,
			category: this.category,
			severity: this.severity,
			context: this.context,
			details: this.details,
			cause: this.cause instanceof Error ? this.cause : undefined,
			timestamp: this.timestamp,
		};
	}

	/**
	 * Creates a FlowtiError from a generic Error.
	 */
	static fromError(error: Error, options: Partial<CreateErrorOptions> = {}): FlowtiError {
		if (error instanceof FlowtiError) {
			return error;
		}

		return new FlowtiError({
			code: options.code ?? "UNKNOWN_ERROR",
			message: options.message ?? error.message,
			category: options.category ?? "unknown",
			severity: options.severity ?? "medium",
			context: options.context,
			details: options.details,
			cause: error,
		});
	}
}

/**
 * Validation error for input/data validation failures.
 */
export class ValidationError extends FlowtiError {
	constructor(options: Omit<CreateErrorOptions, "category">) {
		super({ ...options, category: "validation" });
		this.name = "ValidationError";
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

/**
 * Storage error for persistence-related failures.
 */
export class StorageError extends FlowtiError {
	constructor(options: Omit<CreateErrorOptions, "category">) {
		super({ ...options, category: "storage" });
		this.name = "StorageError";
		Object.setPrototypeOf(this, StorageError.prototype);
	}
}

/**
 * Lifecycle error for plugin initialization/shutdown failures.
 */
export class LifecycleError extends FlowtiError {
	constructor(options: Omit<CreateErrorOptions, "category">) {
		super({ ...options, category: "lifecycle" });
		this.name = "LifecycleError";
		Object.setPrototypeOf(this, LifecycleError.prototype);
	}
}

/**
 * Service error for service-related failures.
 */
export class ServiceError extends FlowtiError {
	constructor(options: Omit<CreateErrorOptions, "category">) {
		super({ ...options, category: "service" });
		this.name = "ServiceError";
		Object.setPrototypeOf(this, ServiceError.prototype);
	}
}

/**
 * Command error for command execution failures.
 */
export class CommandError extends FlowtiError {
	constructor(options: Omit<CreateErrorOptions, "category">) {
		super({ ...options, category: "command" });
		this.name = "CommandError";
		Object.setPrototypeOf(this, CommandError.prototype);
	}
}
