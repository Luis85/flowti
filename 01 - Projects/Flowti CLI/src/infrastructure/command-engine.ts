/**
 * command-engine.ts — Command Engine type definitions and runtime implementation.
 *
 * Defines the interfaces and types for command handling, flag specifications,
 * contexts, and descriptors, plus the runtime parseFlags, validateFlags,
 * and adaptDescriptor functions.
 */

import type { CliDeps } from "./deps.js";
import type { Log } from "./deps.js";
import type { ProjectContext, CommandHandler } from "./types-config.js";
import { dataResponse, handleResponse, getSharedDeps } from "./request-response.js";
import { renderNoProject } from "../ui/renderers/common-renderers.js";
import type { NoProjectModel } from "../ui/renderers/common-renderers.js";
import type { CliResponse } from "./request-response.js";

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

// ── Flag Parsing ─────────────────────────────────────────────────

export function parseFlags(
	raw: Record<string, string | boolean>,
	spec: Record<string, FlagSpec>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, fs] of Object.entries(spec)) {
		const val = raw[key];
		if (val === undefined || val === false) {
			result[key] = fs.default;
			continue;
		}
		if (fs.parse && typeof val === "string") {
			result[key] = fs.parse(val);
			continue;
		}
		switch (fs.type) {
			case "boolean":
				result[key] = val === true || val === "true";
				break;
			case "number":
				result[key] = fs.coerce === "int"
					? parseInt(String(val), 10)
					: parseFloat(String(val));
				break;
			case "list":
				result[key] = typeof val === "string" ? val.split(",").map(s => s.trim()) : [];
				break;
			default:
				result[key] = typeof val === "string" ? val : String(val);
		}
	}
	return result;
}

export interface FlagValidationError {
	error: string;
	hint?: string;
}

export function validateFlags(
	parsed: Record<string, unknown>,
	spec: Record<string, FlagSpec>,
): FlagValidationError | null {
	for (const [key, fs] of Object.entries(spec)) {
		if (fs.required && (parsed[key] === undefined || parsed[key] === "")) {
			return {
				error: `Missing required flag --${key}.`,
				hint: fs.hint ?? `Usage: --${key}=<value>`,
			};
		}
		if (fs.choices && parsed[key] !== undefined && parsed[key] !== "") {
			if (!fs.choices.includes(String(parsed[key]))) {
				return {
					error: `Invalid value "${parsed[key]}" for --${key}. Valid: ${fs.choices.join(", ")}`,
				};
			}
		}
	}
	return null;
}

// ── Engine ───────────────────────────────────────────────────────

export function adaptDescriptor<TFlags = Record<string, unknown>, TModel = unknown>(
	desc: CommandDescriptor<TFlags, TModel>,
): CommandHandler & { __descriptor: CommandDescriptor<TFlags, TModel> } {
	const handler: CommandHandler = (
		flags: Record<string, string | boolean>,
		rawArgs: string[],
		command?: string,
		project?: ProjectContext,
	): void | Promise<void> => {
		const cmd = command ?? "";
		const format = typeof flags.format === "string" ? flags.format : undefined;
		const deps = getSharedDeps();

		// Project guard
		if (desc.requires === "project" && !project) {
			const response = dataResponse<NoProjectModel>(
				{ command: "help" },
				(d: NoProjectModel) => renderNoProject(d, deps.log),
			);
			handleResponse(response, format === "json" ? "json" : "text");
			return;
		}

		// Parse and validate flags — merge unspecified raw flags so handlers can access them
		const specKeys = desc.flags ? new Set(Object.keys(desc.flags as Record<string, FlagSpec>)) : new Set<string>();
		const passthrough: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(flags)) {
			if (!specKeys.has(k)) passthrough[k] = v;
		}
		const parsed = desc.flags ? { ...passthrough, ...parseFlags(flags, desc.flags as Record<string, FlagSpec>) } : { ...passthrough };
		if (desc.flags) {
			const error = validateFlags(parsed, desc.flags as Record<string, FlagSpec>);
			if (error) {
				handleResponse(dataResponse(error, () => {}), format === "json" ? "json" : "text");
				return;
			}
		}

		// Build context
		const ctx: CommandContext<TFlags> = {
			command: cmd,
			flags: parsed as TFlags,
			project,
			deps,
			...(desc.rawArgs ? { rawArgs } : {}),
			...(desc.wildcardPrefix && cmd.startsWith(desc.wildcardPrefix)
				? { wildcard: cmd.substring(desc.wildcardPrefix.length) }
				: {}),
		};

		// Call handler
		const result = desc.handler(ctx);

		// Handle async
		if (result instanceof Promise) {
			return result.then((model) => {
				handleResponse(wrapResponse(model, desc, deps), format === "json" ? "json" : "text");
			});
		}

		handleResponse(wrapResponse(result, desc, deps), format === "json" ? "json" : "text");
	};

	(handler as unknown as { __descriptor: CommandDescriptor<TFlags, TModel> }).__descriptor = desc;
	return handler as CommandHandler & { __descriptor: CommandDescriptor<TFlags, TModel> };
}

function wrapResponse<TFlags, TModel>(
	model: TModel,
	desc: CommandDescriptor<TFlags, TModel>,
	deps: CliDeps,
): CliResponse<TModel> {
	const exitCode = typeof desc.exitCode === "function"
		? desc.exitCode(model)
		: desc.exitCode;

	return {
		data: model,
		render: (d: TModel) => desc.renderer(d, deps.log),
		...(exitCode !== undefined ? { exitCode } : {}),
	};
}

// ── Registration Helper ──────────────────────────────────────────

export function defineCommands<TFlags = Record<string, unknown>, TModel = unknown>(
	descriptors: Array<{ name: string; descriptor: CommandDescriptor<TFlags, TModel> }>,
): Record<string, CommandHandler> {
	const result: Record<string, CommandHandler> = {};
	for (const { name, descriptor } of descriptors) {
		result[name] = adaptDescriptor(descriptor);
	}
	return result;
}
