export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
	debug(system: string, msg: string, data?: unknown): void;
	info(system: string, msg: string, data?: unknown): void;
	warn(system: string, msg: string, data?: unknown): void;
	error(system: string, msg: string, err?: Error, data?: unknown): void;
}
