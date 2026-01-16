/**
 * DebugService - Centralized debug logging for the FileWatcher plugin
 *
 * Enable debug mode via settings or set window.FILEWATCHER_DEBUG = true in console
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	category: string;
	message: string;
	data?: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
	debug: "color: #888",
	info: "color: #4a9eff",
	warn: "color: #ffa500",
	error: "color: #ff4444",
};

const CATEGORY_PREFIX = "[FileWatcher]";

class DebugServiceImpl {
	private enabled = false;
	private history: LogEntry[] = [];
	private maxHistory = 500;

	constructor() {
		// Check for global debug flag
		this.checkGlobalFlag();
	}

	private checkGlobalFlag() {
		// Allow enabling via console: window.FILEWATCHER_DEBUG = true
		if (typeof window !== "undefined") {
			const w = window as unknown as { FILEWATCHER_DEBUG?: boolean };
			if (w.FILEWATCHER_DEBUG) {
				this.enabled = true;
			}
		}
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		if (enabled) {
			console.log(
				`%c${CATEGORY_PREFIX} Debug mode ENABLED`,
				"color: #4a9eff; font-weight: bold"
			);
		}
	}

	isEnabled(): boolean {
		this.checkGlobalFlag();
		return this.enabled;
	}

	private log(
		level: LogLevel,
		category: string,
		message: string,
		data?: unknown
	) {
		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			category,
			message,
			data,
		};

		// Store in history
		this.history.push(entry);
		if (this.history.length > this.maxHistory) {
			this.history.shift();
		}

		// Only output if enabled (or always for errors/warnings)
		if (!this.enabled && level !== "error" && level !== "warn") {
			return;
		}

		const timeStr = entry.timestamp.toISOString().slice(11, 23);
		const prefix = `${CATEGORY_PREFIX}[${category}][${timeStr}]`;

		if (data !== undefined) {
			console[level](
				`%c${prefix} ${message}`,
				LOG_COLORS[level],
				data
			);
		} else {
			console[level](`%c${prefix} ${message}`, LOG_COLORS[level]);
		}
	}

	debug(category: string, message: string, data?: unknown) {
		this.log("debug", category, message, data);
	}

	info(category: string, message: string, data?: unknown) {
		this.log("info", category, message, data);
	}

	warn(category: string, message: string, data?: unknown) {
		this.log("warn", category, message, data);
	}

	error(category: string, message: string, data?: unknown) {
		this.log("error", category, message, data);
	}

	// Get recent logs for debugging
	getHistory(count?: number): LogEntry[] {
		const n = count ?? this.history.length;
		return this.history.slice(-n);
	}

	// Clear history
	clearHistory() {
		this.history = [];
	}

	// Dump history to console (useful for debugging)
	dumpHistory(filter?: { category?: string; level?: LogLevel }) {
		console.group(`${CATEGORY_PREFIX} Log History`);
		for (const entry of this.history) {
			if (filter?.category && entry.category !== filter.category)
				continue;
			if (filter?.level && entry.level !== filter.level) continue;

			const timeStr = entry.timestamp.toISOString().slice(11, 23);
			console.log(
				`%c[${entry.level}][${entry.category}][${timeStr}] ${entry.message}`,
				LOG_COLORS[entry.level],
				entry.data ?? ""
			);
		}
		console.groupEnd();
	}
}

// Singleton instance
export const Debug = new DebugServiceImpl();

// Expose to window for debugging
if (typeof window !== "undefined") {
	(window as unknown as { FileWatcherDebug: DebugServiceImpl }).FileWatcherDebug = Debug;
}
