export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerPort {
	debug(source: string, message: string, data?: unknown): void;
	info(source: string, message: string, data?: unknown): void;
	warn(source: string, message: string, data?: unknown): void;
	error(source: string, message: string, data?: unknown): void;
	setLevel(level: LogLevel): void;
}
