/**
 * LogService - Persistent logging for the File Watcher plugin
 *
 * Stores logs in memory with configurable max entries.
 * Logs can be viewed in the dashboard modal.
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

/** Default max log entries to keep in memory */
const DEFAULT_MAX_ENTRIES = 1000;

/** Singleton log service */
class LogServiceImpl {
	private logs: LogEntry[] = [];
	private nextId = 1;
	private maxEntries: number = DEFAULT_MAX_ENTRIES;
	private enabled = true;
	private minLevel: LogLevel = "info";

	private levelPriority: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	/** Listeners for real-time updates */
	private listeners: Set<(entry: LogEntry) => void> = new Set();

	/**
	 * Configure the log service
	 */
	configure(options: {
		maxEntries?: number;
		enabled?: boolean;
		minLevel?: LogLevel;
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

/** Singleton instance */
export const LogService = new LogServiceImpl();
