import type { EventBus } from '../domain/shared/event-bus.js';
import type { LoggerPort, LogLevel } from '../domain/shared/logger-port.js';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, error: 2 };

export class Logger implements LoggerPort {
	private level: LogLevel;
	private readonly bus: EventBus;

	constructor(bus: EventBus, level: LogLevel) {
		this.bus = bus;
		this.level = level;
	}

	debug(source: string, message: string, data?: unknown): void {
		if (!this.shouldLog('debug')) return;
		console.debug(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'debug', source, message, data });
	}

	info(source: string, message: string, data?: unknown): void {
		if (!this.shouldLog('info')) return;
		console.log(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'info', source, message, data });
	}

	error(source: string, message: string, data?: unknown): void {
		console.error(`[agentonomous:${source}]`, message, data);
		this.bus.emit('log', { level: 'error', source, message, data });
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	private shouldLog(level: LogLevel): boolean {
		return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
	}
}
