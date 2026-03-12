/**
 * request-response.ts — Request/Response abstraction for CLI commands.
 *
 * Inspired by Symfony's HttpFoundation: every command receives an immutable
 * CliRequest bag and returns a CliResponse describing what to output.
 * The response handler at the edge decides JSON vs human-readable rendering.
 *
 * This decouples controllers from I/O — they never call log() directly.
 */

import type { ProjectContext } from "./types.js";
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
function getSharedDeps(): CliDeps {
	if (!_sharedDeps) {
		_sharedDeps = createDefaultDeps();
	}
	return _sharedDeps;
}

// ── Request ─────────────────────────────────────────────────────────

/** Immutable input bag — everything a controller needs to handle a command. */
export interface CliRequest {
	/** The resolved command name (e.g. "health", "build:check"). */
	command: string;
	/** Parsed flags (e.g. { format: "json", verbose: true }). */
	flags: Record<string, string | boolean>;
	/** Raw CLI arguments (process.argv.slice(2)). */
	rawArgs: string[];
	/** Resolved project context (undefined for project-free commands). */
	project?: ProjectContext;
	/** Output format derived from --format flag. */
	format: OutputFormat;
	/** Injectable dependencies — controllers use this instead of importing singletons. */
	deps: CliDeps;
}

/** Construct a CliRequest. */
export function createRequest(
	command: string,
	flags: Record<string, string | boolean>,
	rawArgs: string[],
	project?: ProjectContext,
	deps?: CliDeps,
): CliRequest {
	return {
		command,
		flags,
		rawArgs,
		project,
		format: flags?.format === "json" ? "json" : "text",
		deps: deps ?? getSharedDeps(),
	};
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

/** Create a response with just an exit code (no output). */
export function exitResponse(code: number): CliResponse<void> {
	return { exitCode: code };
}

/** Empty success response — command produced side effects only. */
export function okResponse(): CliResponse<void> {
	return {};
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

// ── Controller action type ──────────────────────────────────────────

/**
 * A controller action — receives a CliRequest, returns a CliResponse.
 * May return void for fire-and-forget side effects (shell commands, etc.).
 *
 * Uses `any` deliberately: CliResponse's contravariant `render` callback
 * prevents CliResponse<T> from being assignable to CliResponse<unknown>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControllerAction = (req: CliRequest) => CliResponse<any> | void | Promise<CliResponse<any> | void>;

// ── Adapter ─────────────────────────────────────────────────────────

import type { CommandHandler } from "./types.js";

/**
 * Adapt a ControllerAction to the CommandHandler signature.
 * Deps are resolved lazily from the shared container when the handler is invoked.
 */
export function adapt(action: ControllerAction): CommandHandler {
	return (flags, rawArgs, command, project) => {
		const req = createRequest(command ?? "", flags ?? {}, rawArgs ?? [], project);
		const result = action(req);
		if (result && typeof (result as Promise<unknown>).then === "function") {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (result as Promise<CliResponse<any> | void>).then((res) => handleResponse(res, req.format));
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		handleResponse(result as CliResponse<any> | void, req.format);
	};
}
