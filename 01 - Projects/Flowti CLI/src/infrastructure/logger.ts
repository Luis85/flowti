/**
 * logger.ts — Centralized console output for the CLI.
 *
 * All terminal output routes through here so that `no-console` can be
 * enforced everywhere else. This is the ONLY file that may call console directly.
 */

/* eslint-disable no-console */

export function log(...args: unknown[]): void {
	console.log(...args);
}

export function info(...args: unknown[]): void {
	console.log(...args);
}

export function blank(): void {
	console.log();
}
