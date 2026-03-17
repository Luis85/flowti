import type { IEventBus } from "../events/types";
import type { ILogger, LogEntry, LoggerServiceOptions, LogLevel } from "./types";

/**
 * Logger service for the Flowti application.
 *
 * Features:
 * - Four log levels: debug, info, warn, error
 * - Debug logs only shown when debugMode is enabled
 * - Emits events for each log entry (useful for log aggregation)
 * - Supports context prefixes for identifying log sources
 * - Integrates with settings.changed events to toggle debug mode
 *
 * @example Basic usage
 * ```typescript
 * const logger = new LoggerService({ debugMode: true });
 * logger.info("Application started");
 * logger.debug("Debug information", { data: 123 });
 * ```
 *
 * @example With context
 * ```typescript
 * const userLogger = logger.setContext("UserService");
 * userLogger.info("User created"); // [UserService] User created
 * ```
 *
 * @example Event-driven logging
 * ```typescript
 * const logger = new LoggerService({ eventBus });
 *
 * // Listen for all log events elsewhere
 * eventBus.on("log.entry", (event) => {
 *   sendToLogServer(event.payload);
 * });
 *
 * // Listen only for errors
 * eventBus.on("log.error", (event) => {
 *   alertAdmin(event.payload);
 * });
 * ```
 */
export class LoggerService implements ILogger {
	private eventBus?: IEventBus;
	private debugMode: boolean;
	private prefix: string;
	private context?: string;
	private traceUnsub?: () => void;

	constructor(options: LoggerServiceOptions = {}) {
		this.eventBus = options.eventBus;
		this.debugMode = options.debugMode ?? false;
		this.prefix = options.prefix ?? "Flowti";

		if (this.debugMode) {
			this.startEventTrace();
		}
	}

	debug(message: string, data?: unknown): void {
		if (this.debugMode) {
			this.log("debug", message, data);
		}
	}

	info(message: string, data?: unknown): void {
		this.log("info", message, data);
	}

	warn(message: string, data?: unknown): void {
		this.log("warn", message, data);
	}

	error(message: string, data?: unknown): void {
		this.log("error", message, data);
	}

	setContext(context: string): ILogger {
		const contextLogger = new LoggerService({
			eventBus: this.eventBus,
			debugMode: this.debugMode,
			prefix: this.prefix,
		});
		contextLogger.context = context;
		return contextLogger;
	}

	setDebugMode(enabled: boolean): void {
		this.debugMode = enabled;
		if (enabled) {
			this.startEventTrace();
		} else {
			this.stopEventTrace();
		}
	}

	/**
	 * Internal log method that handles formatting and event emission.
	 */
	private log(level: LogLevel, message: string, data?: unknown): void {
		const entry: LogEntry = {
			level,
			message,
			context: this.context,
			data,
			timestamp: new Date().toISOString(),
		};

		// Format and output to console
		const formattedMessage = this.formatMessage(entry);
		this.writeToConsole(level, formattedMessage, data);

		// Emit events (fire and forget - don't await)
		this.emitLogEvents(entry);
	}

	/**
	 * Formats the log message with prefix and context.
	 */
	private formatMessage(entry: LogEntry): string {
		const parts = [this.prefix];
		if (entry.context) {
			parts.push(entry.context);
		}
		return `[${parts.join(":")}] ${entry.message}`;
	}

	/**
	 * Writes to the appropriate console method.
	 */
	private writeToConsole(level: LogLevel, message: string, data?: unknown): void {
		switch (level) {
			case "debug":
			case "info":
				if (data !== undefined) console.debug(message, data);
				else console.debug(message);
				break;
			case "warn":
				if (data !== undefined) console.warn(message, data);
				else console.warn(message);
				break;
			case "error":
				if (data !== undefined) console.error(message, data);
				else console.error(message);
				break;
		}
	}

	/**
	 * Emits log events to the event bus.
	 */
	private emitLogEvents(entry: LogEntry): void {
		if (!this.eventBus) return;

		// Emit general log event
		void this.eventBus.emit("log.entry", entry);

		// Emit specific error event for error logs
		if (entry.level === "error") {
			void this.eventBus.emit("log.error", entry);
		}
	}

	/**
	 * Subscribes a wildcard listener that logs every event to the console.
	 * Skips `log.*` events to avoid infinite recursion.
	 */
	private startEventTrace(): void {
		if (this.traceUnsub || !this.eventBus) return;

		this.traceUnsub = this.eventBus.on("*", (event) => {
			if (event.type.startsWith("log.")) return;

			const tag = `[${this.prefix}:EventTrace]`;
			console.debug(tag, event.type, event.payload);
		});
	}

	/**
	 * Removes the wildcard event trace listener.
	 */
	private stopEventTrace(): void {
		this.traceUnsub?.();
		this.traceUnsub = undefined;
	}
}
