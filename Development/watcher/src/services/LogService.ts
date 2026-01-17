/**
 * LogService - Unified logging for the File Watcher plugin
 *
 * Features:
 * - In-memory log storage for Dashboard display
 * - Optional console output (when debugMode is enabled)
 * - Real-time subscriptions for UI updates
 * - Filtering by level, category, mappingId, search text
 * - Configurable log retention
 *
 * Architecture:
 * - ILogService interface for dependency injection in tests
 * - LogServiceImpl is the concrete implementation
 * - LogService singleton for backward compatibility
 * - createLogService() factory for test instances
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
	| "Watcher"
	| "Sync"
	| "Reconcile"
	| "Plugin"
	| "Manager";

export interface LogEntry {
	id: number;
	timestamp: Date;
	level: LogLevel;
	category: LogCategory;
	message: string;
	details?: Record<string, unknown>;
	mappingId?: string;
	filePath?: string;
}

export interface LogFilter {
	levels?: LogLevel[];
	categories?: LogCategory[];
	mappingId?: string;
	search?: string;
	since?: Date;
}

export interface LogOptions {
	details?: Record<string, unknown>;
	mappingId?: string;
	filePath?: string;
}

/**
 * Interface for LogService - allows dependency injection in tests
 */
export interface ILogService {
	configure(options: {
		maxEntries?: number;
		enabled?: boolean;
		minLevel?: LogLevel;
		consoleOutput?: boolean;
	}): void;

	isDebugEnabled(): boolean;
	setDebugEnabled(enabled: boolean): void;

	log(
		level: LogLevel,
		category: LogCategory,
		message: string,
		options?: LogOptions
	): LogEntry | null;

	debug(category: LogCategory, message: string, options?: LogOptions): LogEntry | null;
	info(category: LogCategory, message: string, options?: LogOptions): LogEntry | null;
	warn(category: LogCategory, message: string, options?: LogOptions): LogEntry | null;
	error(category: LogCategory, message: string, options?: LogOptions): LogEntry | null;

	getLogs(filter?: LogFilter): LogEntry[];
	getRecentLogs(count: number, filter?: LogFilter): LogEntry[];
	getCounts(): Record<LogLevel, number>;
	getErrorCountSince(since: Date): number;

	clear(): void;
	subscribe(listener: (entry: LogEntry) => void): () => void;
	exportAsJson(): string;
	dumpHistory(filter?: { category?: LogCategory; level?: LogLevel }): void;

	readonly count: number;
}

/** Console colors for each log level */
const LOG_COLORS: Record<LogLevel, string> = {
	debug: "color: #888",
	info: "color: #4a9eff",
	warn: "color: #ffa500",
	error: "color: #ff4444",
};

const CONSOLE_PREFIX = "[FileWatcher]";

/** Default max log entries to keep in memory */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Concrete implementation of LogService.
 * Can be instantiated for tests or used as singleton via LogService export.
 */
export class LogServiceImpl implements ILogService {
	private logs: LogEntry[] = [];
	private nextId = 1;
	private maxEntries: number = DEFAULT_MAX_ENTRIES;
	private enabled = true;
	private minLevel: LogLevel = "info";

	/** Whether to output logs to console (debug mode) */
	private consoleOutput = false;

	/** Whether to always output errors/warnings to console regardless of debugMode */
	private alwaysLogErrorsToConsole = true;

	private levelPriority: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	/** Listeners for real-time updates */
	private listeners: Set<(entry: LogEntry) => void> = new Set();

	constructor() {
		// Check for global debug flag
		this.checkGlobalFlag();
	}

	/**
	 * Check for window.FILEWATCHER_DEBUG flag
	 */
	private checkGlobalFlag() {
		if (typeof window !== "undefined") {
			const w = window as unknown as { FILEWATCHER_DEBUG?: boolean };
			if (w.FILEWATCHER_DEBUG) {
				this.consoleOutput = true;
				this.minLevel = "debug";
			}
		}
	}

	/**
	 * Configure the log service
	 */
	configure(options: {
		maxEntries?: number;
		enabled?: boolean;
		minLevel?: LogLevel;
		consoleOutput?: boolean;
	}) {
		if (options.maxEntries !== undefined) {
			this.maxEntries = options.maxEntries;
			this.trimLogs();
		}
		if (options.enabled !== undefined) {
			this.enabled = options.enabled;
		}
		if (options.minLevel !== undefined) {
			this.minLevel = options.minLevel;
		}
		if (options.consoleOutput !== undefined) {
			this.consoleOutput = options.consoleOutput;
			if (options.consoleOutput) {
				console.log(
					`%c${CONSOLE_PREFIX} Debug mode ENABLED`,
					"color: #4a9eff; font-weight: bold"
				);
			}
		}
	}

	/**
	 * Check if console output (debug mode) is enabled
	 */
	isDebugEnabled(): boolean {
		this.checkGlobalFlag();
		return this.consoleOutput;
	}

	/**
	 * Set debug mode (console output)
	 */
	setDebugEnabled(enabled: boolean) {
		this.consoleOutput = enabled;
		if (enabled) {
			this.minLevel = "debug";
			console.log(
				`%c${CONSOLE_PREFIX} Debug mode ENABLED`,
				"color: #4a9eff; font-weight: bold"
			);
		}
	}

	/**
	 * Add a log entry
	 */
	log(
		level: LogLevel,
		category: LogCategory,
		message: string,
		options?: {
			details?: Record<string, unknown>;
			mappingId?: string;
			filePath?: string;
		}
	): LogEntry | null {
		if (!this.enabled) return null;
		if (this.levelPriority[level] < this.levelPriority[this.minLevel])
			return null;

		const entry: LogEntry = {
			id: this.nextId++,
			timestamp: new Date(),
			level,
			category,
			message,
			details: options?.details,
			mappingId: options?.mappingId,
			filePath: options?.filePath,
		};

		this.logs.push(entry);
		this.trimLogs();

		// Console output
		this.logToConsole(entry, options?.details);

		// Notify listeners
		for (const listener of this.listeners) {
			try {
				listener(entry);
			} catch (e) {
				console.error("Log listener error:", e);
			}
		}

		return entry;
	}

	/**
	 * Output to console if debug mode is enabled
	 */
	private logToConsole(entry: LogEntry, data?: unknown) {
		// Always log errors/warnings to console, or all logs if debug mode is on
		const shouldLog =
			this.consoleOutput ||
			(this.alwaysLogErrorsToConsole &&
				(entry.level === "error" || entry.level === "warn"));

		if (!shouldLog) return;

		const timeStr = entry.timestamp.toISOString().slice(11, 23);
		const prefix = `${CONSOLE_PREFIX}[${entry.category}][${timeStr}]`;

		if (data !== undefined) {
			console[entry.level](
				`%c${prefix} ${entry.message}`,
				LOG_COLORS[entry.level],
				data
			);
		} else {
			console[entry.level](
				`%c${prefix} ${entry.message}`,
				LOG_COLORS[entry.level]
			);
		}
	}

	/** Convenience methods */
	debug(
		category: LogCategory,
		message: string,
		options?: {
			details?: Record<string, unknown>;
			mappingId?: string;
			filePath?: string;
		}
	) {
		return this.log("debug", category, message, options);
	}

	info(
		category: LogCategory,
		message: string,
		options?: {
			details?: Record<string, unknown>;
			mappingId?: string;
			filePath?: string;
		}
	) {
		return this.log("info", category, message, options);
	}

	warn(
		category: LogCategory,
		message: string,
		options?: {
			details?: Record<string, unknown>;
			mappingId?: string;
			filePath?: string;
		}
	) {
		return this.log("warn", category, message, options);
	}

	error(
		category: LogCategory,
		message: string,
		options?: {
			details?: Record<string, unknown>;
			mappingId?: string;
			filePath?: string;
		}
	) {
		return this.log("error", category, message, options);
	}

	/**
	 * Get logs with optional filtering
	 */
	getLogs(filter?: LogFilter): LogEntry[] {
		let result = [...this.logs];

		if (filter) {
			if (filter.levels && filter.levels.length > 0) {
				result = result.filter((e) => filter.levels!.includes(e.level));
			}
			if (filter.categories && filter.categories.length > 0) {
				result = result.filter((e) =>
					filter.categories!.includes(e.category)
				);
			}
			if (filter.mappingId) {
				result = result.filter((e) => e.mappingId === filter.mappingId);
			}
			if (filter.search) {
				const search = filter.search.toLowerCase();
				result = result.filter(
					(e) =>
						e.message.toLowerCase().includes(search) ||
						e.filePath?.toLowerCase().includes(search)
				);
			}
			if (filter.since) {
				result = result.filter((e) => e.timestamp >= filter.since!);
			}
		}

		return result;
	}

	/**
	 * Get recent logs (most recent first)
	 */
	getRecentLogs(count: number, filter?: LogFilter): LogEntry[] {
		const logs = this.getLogs(filter);
		return logs.slice(-count).reverse();
	}

	/**
	 * Get log counts by level
	 */
	getCounts(): Record<LogLevel, number> {
		const counts: Record<LogLevel, number> = {
			debug: 0,
			info: 0,
			warn: 0,
			error: 0,
		};

		for (const entry of this.logs) {
			counts[entry.level]++;
		}

		return counts;
	}

	/**
	 * Get error count since a given time
	 */
	getErrorCountSince(since: Date): number {
		return this.logs.filter(
			(e) => e.level === "error" && e.timestamp >= since
		).length;
	}

	/**
	 * Clear all logs
	 */
	clear() {
		this.logs = [];
	}

	/**
	 * Subscribe to new log entries
	 */
	subscribe(listener: (entry: LogEntry) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Export logs as JSON string
	 */
	exportAsJson(): string {
		return JSON.stringify(this.logs, null, 2);
	}

	/**
	 * Dump logs to console (useful for debugging)
	 */
	dumpHistory(filter?: { category?: LogCategory; level?: LogLevel }) {
		console.group(`${CONSOLE_PREFIX} Log History`);
		for (const entry of this.logs) {
			if (filter?.category && entry.category !== filter.category)
				continue;
			if (filter?.level && entry.level !== filter.level) continue;

			const timeStr = entry.timestamp.toISOString().slice(11, 23);
			console.log(
				`%c[${entry.level}][${entry.category}][${timeStr}] ${entry.message}`,
				LOG_COLORS[entry.level],
				entry.details ?? ""
			);
		}
		console.groupEnd();
	}

	/**
	 * Get total log count
	 */
	get count(): number {
		return this.logs.length;
	}

	private trimLogs() {
		if (this.logs.length > this.maxEntries) {
			this.logs = this.logs.slice(-this.maxEntries);
		}
	}
}

/** Singleton instance for backward compatibility */
export const LogService: ILogService = new LogServiceImpl();

/**
 * Factory function to create new LogService instances.
 * Use this for tests to get isolated log instances.
 */
export function createLogService(options?: {
	maxEntries?: number;
	enabled?: boolean;
	minLevel?: LogLevel;
	consoleOutput?: boolean;
}): ILogService {
	const service = new LogServiceImpl();
	if (options) {
		service.configure(options);
	}
	return service;
}

/**
 * Create a no-op LogService for tests that don't care about logging.
 * All methods are stubs that do nothing.
 */
export function createNoOpLogService(): ILogService {
	return {
		configure: () => {},
		isDebugEnabled: () => false,
		setDebugEnabled: () => {},
		log: () => null,
		debug: () => null,
		info: () => null,
		warn: () => null,
		error: () => null,
		getLogs: () => [],
		getRecentLogs: () => [],
		getCounts: () => ({ debug: 0, info: 0, warn: 0, error: 0 }),
		getErrorCountSince: () => 0,
		clear: () => {},
		subscribe: () => () => {},
		exportAsJson: () => "[]",
		dumpHistory: () => {},
		count: 0,
	};
}

// Expose to window for debugging
if (typeof window !== "undefined") {
	(
		window as unknown as { FileWatcherLog: ILogService }
	).FileWatcherLog = LogService;
}
