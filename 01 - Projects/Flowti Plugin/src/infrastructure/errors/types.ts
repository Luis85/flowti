/**
 * Error handling types and interfaces for Flowti.
 *
 * Provides structured error types for different categories of failures,
 * enabling consistent error handling and reporting across the application.
 */

import { FlowtiError } from "./FlowtiError";

/**
 * Error categories for classification and handling.
 */
export type ErrorCategory =
	| "validation"
	| "storage"
	| "lifecycle"
	| "service"
	| "command"
	| "event"
	| "unknown";

/**
 * Severity levels for errors.
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Structured error information for logging and event emission.
 */
export interface FlowtiErrorInfo {
	/** Unique error code for identification */
	code: string;
	/** Human-readable error message */
	message: string;
	/** Error category for routing and handling */
	category: ErrorCategory;
	/** Severity level */
	severity: ErrorSeverity;
	/** Context where the error occurred (e.g., service name) */
	context?: string;
	/** Additional error details */
	details?: unknown;
	/** Original error if this wraps another error */
	cause?: Error;
	/** ISO timestamp when the error occurred */
	timestamp: string;
}

/**
 * Interface for the error service.
 */
export interface IErrorService {
	/**
	 * Handles an error with appropriate logging and event emission.
	 */
	handle(error: FlowtiError | Error, context?: string): void;

	/**
	 * Creates a FlowtiError from options.
	 */
	create(options: CreateErrorOptions): FlowtiError;

	/**
	 * Wraps an operation with error handling.
	 */
	wrap<T>(
		operation: () => T | Promise<T>,
		options: WrapErrorOptions
	): Promise<T>;
}

/**
 * Options for creating a FlowtiError.
 */
export interface CreateErrorOptions {
	code: string;
	message: string;
	category: ErrorCategory;
	severity?: ErrorSeverity;
	context?: string;
	details?: unknown;
	cause?: Error;
}

/**
 * Options for wrapping an operation with error handling.
 */
export interface WrapErrorOptions {
	code: string;
	message: string;
	category: ErrorCategory;
	severity?: ErrorSeverity;
	context?: string;
	/** If true, rethrows the error after handling */
	rethrow?: boolean;
	/** Fallback value to return on error (if not rethrowing) */
	fallback?: unknown;
}

/**
 * Configuration options for the ErrorService.
 */
export interface ErrorServiceOptions {
	/** Event bus for emitting error events */
	eventBus?: import("../events/types").IEventBus;
	/** Logger for error logging */
	logger?: import("../logger/types").ILogger;
}
