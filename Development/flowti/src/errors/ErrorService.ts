import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import { FlowtiError } from "./FlowtiError";
import type {
	CreateErrorOptions,
	ErrorServiceOptions,
	IErrorService,
	WrapErrorOptions,
} from "./types";

/**
 * Service for centralized error handling.
 *
 * Provides consistent error handling, logging, and event emission
 * across the application. Supports wrapping operations with automatic
 * error handling and optional fallback values.
 *
 * @example Basic usage
 * ```typescript
 * const errorService = new ErrorService({ eventBus, logger });
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   errorService.handle(error, "MyService");
 * }
 * ```
 *
 * @example Wrapping an operation
 * ```typescript
 * const result = await errorService.wrap(
 *   () => fetchData(),
 *   {
 *     code: "FETCH_FAILED",
 *     message: "Failed to fetch data",
 *     category: "service",
 *     context: "DataService",
 *     fallback: [],
 *   }
 * );
 * ```
 */
export class ErrorService implements IErrorService {
	private eventBus?: IEventBus;
	private logger?: ILogger;

	constructor(options: ErrorServiceOptions = {}) {
		this.eventBus = options.eventBus;
		this.logger = options.logger;
	}

	/**
	 * Handles an error with appropriate logging and event emission.
	 */
	handle(error: FlowtiError | Error, context?: string): void {
		const flowtiError =
			error instanceof FlowtiError
				? error
				: FlowtiError.fromError(error, { context });

		// Log based on severity
		const errorInfo = flowtiError.toInfo();
		const logMessage = `[${errorInfo.code}] ${errorInfo.message}`;

		if (this.logger) {
			switch (errorInfo.severity) {
				case "critical":
				case "high":
					this.logger.error(logMessage, errorInfo);
					break;
				case "medium":
					this.logger.warn(logMessage, errorInfo);
					break;
				case "low":
					this.logger.info(logMessage, errorInfo);
					break;
			}
		}

		// Emit error event
		void this.eventBus?.emit("error.occurred", errorInfo);
	}

	/**
	 * Creates a FlowtiError from options.
	 */
	create(options: CreateErrorOptions): FlowtiError {
		return new FlowtiError(options);
	}

	/**
	 * Wraps an operation with error handling.
	 */
	async wrap<T>(
		operation: () => T | Promise<T>,
		options: WrapErrorOptions
	): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			const flowtiError = new FlowtiError({
				...options,
				cause: error instanceof Error ? error : undefined,
			});

			this.handle(flowtiError);

			if (options.rethrow) {
				throw flowtiError;
			}

			return options.fallback as T;
		}
	}
}
