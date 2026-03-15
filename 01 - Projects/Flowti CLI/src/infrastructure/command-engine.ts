/**
 * command-engine.ts — Command Engine type definitions.
 *
 * Defines the interfaces and types for command handling, flag specifications,
 * contexts, and descriptors. This is types-only; implementation follows.
 */

import type { CliDeps } from "./deps.js";
import type { Log } from "./deps.js";
import type { ProjectContext } from "./types-config.js";

// ── Types ────────────────────────────────────────────────────────

/** Logging function type. */
export type LogFn = Log;

/** Renderer function type — takes typed data and log function, produces output. */
export type RendererFn<T> = (data: T, log: LogFn) => void;

/** Flag specification — metadata for command-line flag parsing. */
export interface FlagSpec {
	type: "string" | "boolean" | "number" | "list";
	required?: boolean;
	default?: unknown;
	choices?: string[];
	coerce?: "int" | "float";
	hint?: string;
	parse?: (raw: string) => unknown;
}

/** Context passed to command handlers — includes parsed flags, project, and deps. */
export interface CommandContext<TFlags = Record<string, unknown>> {
	command: string;
	flags: TFlags;
	rawArgs?: string[];
	project?: ProjectContext;
	deps: CliDeps;
	wildcard?: string;
}

/** Descriptor for a command — defines flags, handler, and renderer. */
export interface CommandDescriptor<TFlags = Record<string, unknown>, TModel = unknown> {
	requires?: "project";
	flags?: Record<string, FlagSpec>;
	rawArgs?: boolean;
	wildcardPrefix?: string;
	handler: (ctx: CommandContext<TFlags>) => TModel | Promise<TModel>;
	renderer: RendererFn<TModel>;
	exitCode?: number | ((model: TModel) => number | undefined);
}
