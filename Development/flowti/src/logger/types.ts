import { IEventBus } from "src/events/types";

/**
 * Log levels in order of severity.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log entry structure.
 */
export interface LogEntry {
	level: LogLevel;
	message: string;
	context?: string;
	data?: unknown;
	timestamp: string;
}

/**
 * Interface for the logger service.
 */
export interface ILogger {
	/**
	 * Log a debug message. Only shown when debug mode is enabled.
	 */
	debug(message: string, data?: unknown): void;

	/**
	 * Log an info message.
	 */
	info(message: string, data?: unknown): void;

	/**
	 * Log a warning message.
	 */
	warn(message: string, data?: unknown): void;

	/**
	 * Log an error message.
	 */
	error(message: string, data?: unknown): void;

	/**
	 * Set the context prefix for log messages (e.g., service name).
	 */
	setContext(context: string): ILogger;

	/**
	 * Enable or disable debug mode.
	 */
	setDebugMode(enabled: boolean): void;
}


/**
 * Configuration options for the LoggerService.
 */
export interface LoggerServiceOptions {
	/** Event bus for emitting log events */
	eventBus?: IEventBus;
	/** Initial debug mode state */
	debugMode?: boolean;
	/** Prefix for log messages */
	prefix?: string;
}
