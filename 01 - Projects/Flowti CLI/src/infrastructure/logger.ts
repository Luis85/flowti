/**
 * logger.ts — Centralized console output for the CLI.
 *
 * All terminal output routes through here so that `no-console` can be
 * enforced everywhere else. This is the ONLY file that may call console directly.
 *
 * Supports global flags:
 *   --quiet    Suppresses log/info/blank output (errors and warnings still shown)
 *   --verbose  Enables debug output
 *   --no-color Strips ANSI escape sequences from all output
 */

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export type LogLevel = "debug" | "normal" | "quiet";

let level: LogLevel = "normal";
let colorEnabled = true;

/** Configure output level. Called once from main before any output. */
export function setLogLevel(newLevel: LogLevel): void {
	level = newLevel;
}

/** Disable ANSI color output. Called once from main when --no-color is set. */
export function setColorEnabled(enabled: boolean): void {
	colorEnabled = enabled;
}

/** Current log level (for testing). */
export function getLogLevel(): LogLevel {
	return level;
}

/** Whether color is enabled (for testing). */
export function isColorEnabled(): boolean {
	return colorEnabled;
}

function strip(args: unknown[]): unknown[] {
	if (colorEnabled) return args;
	return args.map((a) => typeof a === "string" ? a.replace(ANSI_RE, "") : a);
}

export function debug(...args: unknown[]): void {
	if (level !== "debug") return;
	console.debug(...strip(args));
}

export function log(...args: unknown[]): void {
	if (level === "quiet") return;
	console.log(...strip(args));
}

export function info(...args: unknown[]): void {
	if (level === "quiet") return;
	console.log(...strip(args));
}

export function warn(...args: unknown[]): void {
	console.warn(...strip(args));
}

export function error(...args: unknown[]): void {
	console.error(...strip(args));
}

export function blank(): void {
	if (level === "quiet") return;
	console.log();
}
