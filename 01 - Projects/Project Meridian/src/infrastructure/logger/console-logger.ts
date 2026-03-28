import type { Logger, LogLevel } from '../../domain/core/logger.js';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createConsoleLogger(minLevel: LogLevel = 'debug'): Logger {
	const threshold = LEVELS[minLevel];

	function format(level: LogLevel, system: string, msg: string, data?: unknown): string {
		const timestamp = new Date().toISOString();
		const base = `[${timestamp}] [${level.toUpperCase()}] [${system}] ${msg}`;
		if (data !== undefined) {
			return `${base} ${JSON.stringify(data)}`;
		}
		return base;
	}

	return {
		debug(system, msg, data) {
			if (LEVELS.debug >= threshold) console.log(format('debug', system, msg, data));
		},
		info(system, msg, data) {
			if (LEVELS.info >= threshold) console.log(format('info', system, msg, data));
		},
		warn(system, msg, data) {
			if (LEVELS.warn >= threshold) console.warn(format('warn', system, msg, data));
		},
		error(system, msg, err, data) {
			const errorData = err !== undefined
				? (data !== undefined ? { error: err.message, ...(data as Record<string, unknown>) } : { error: err.message })
				: data;
			if (LEVELS.error >= threshold) console.error(format('error', system, msg, errorData));
		},
	};
}
