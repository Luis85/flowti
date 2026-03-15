/**
 * request-response.ts — Response abstraction for CLI commands.
 *
 * Provides the CliResponse type and handleResponse function used by
 * the command engine to render output (JSON or human-readable).
 *
 * This decouples controllers from I/O — they never call log() directly.
 */

import type { OutputFormat } from "./output.js";
import type { CliDeps } from "./deps.js";
import { createDefaultDeps } from "./deps.js";
import { log } from "./logger.js";
import { proc } from "./proc.js";

// ── Shared deps (set once by main.ts) ───────────────────────────────

let _sharedDeps: CliDeps | undefined;

/** Initialize the shared dependency container. Called once from main.ts. */
export function initializeDeps(deps: CliDeps): void {
	_sharedDeps = deps;
}

/** Get the shared deps (lazy-creates production deps if not initialized). */
export function getSharedDeps(): CliDeps {
	if (!_sharedDeps) {
		_sharedDeps = createDefaultDeps();
	}
	return _sharedDeps;
}

// ── Response ────────────────────────────────────────────────────────

/** Output bag — describes what the CLI should render after a controller runs. */
export interface CliResponse<T = unknown> {
	/** Data payload — serialized as JSON when format is "json". */
	data?: T;
	/** Human-readable renderer — called when format is "text". */
	render?: (data: T) => void;
	/** Process exit code (0 = success, omit for default 0). */
	exitCode?: number;
}

/** Create a response with data and a human-readable renderer. */
export function dataResponse<T>(data: T, render: (data: T) => void): CliResponse<T> {
	return { data, render };
}

// ── Response handler ────────────────────────────────────────────────

/**
 * Process a CliResponse — the single point where output reaches the user.
 * JSON mode serializes data; text mode calls the human renderer.
 * Non-zero exitCode terminates the process after rendering.
 */
export function handleResponse<T>(response: CliResponse<T> | void, format: OutputFormat): void {
	if (!response) return;

	if (response.data !== undefined) {
		if (format === "json") {
			log(JSON.stringify(response.data));
		} else if (response.render) {
			response.render(response.data);
		}
	}

	if (response.exitCode !== undefined && response.exitCode !== 0) {
		proc.exit(response.exitCode);
	}
}
