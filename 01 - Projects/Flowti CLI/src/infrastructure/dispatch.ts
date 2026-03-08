/**
 * dispatch.ts — Pure command dispatch logic.
 *
 * Extracted from main.ts for testability — no I/O, no side effects.
 */

import type { CommandHandler, ProjectContext } from "./types.js";

export type DispatchResult =
	| { action: "help"; section: string }
	| { action: "run"; handler: CommandHandler; command: string; project?: ProjectContext }
	| { action: "no-project"; command: string }
	| { action: "unknown"; command: string | null }
	| { action: "none" };

// ── Dispatch helpers ─────────────────────────────────────────────────

function resolveHelpSection(flags: Record<string, string | boolean>, rawArgs: string[]): string {
	return Object.keys(flags)[0] ?? rawArgs[1] ?? "main";
}

function resolveKnownHandler(
	command: string, handlers: Record<string, CommandHandler>,
	projectFreeSet: Set<string>, project: ProjectContext | null,
): DispatchResult | null {
	if (!(command in handlers)) return null;
	const handler = handlers[command];
	if (!project && !projectFreeSet.has(command)) {
		return { action: "no-project", command };
	}
	return { action: "run", handler, command, project: project ?? undefined };
}

function resolveWildcard(
	command: string, wildcardHandler: CommandHandler | undefined, project: ProjectContext | null,
): DispatchResult | null {
	if (!command.startsWith("report:") || !wildcardHandler) return null;
	if (!project) return { action: "no-project", command };
	return { action: "run", handler: wildcardHandler, command, project };
}

/**
 * Pure function: resolves a command string + flags into a dispatch result.
 * No I/O — just decision logic.
 */
export function resolveCommand(
	command: string | null,
	flags: Record<string, string | boolean>,
	rawArgs: string[],
	handlers: Record<string, CommandHandler>,
	projectFreeSet: Set<string>,
	wildcardHandler: CommandHandler | undefined,
	project: ProjectContext | null,
): DispatchResult {
	if (command === "help") {
		return { action: "help", section: resolveHelpSection(flags, rawArgs) };
	}

	if (command) {
		const known = resolveKnownHandler(command, handlers, projectFreeSet, project);
		if (known) return known;

		const wild = resolveWildcard(command, wildcardHandler, project);
		if (wild) return wild;

		return { action: "unknown", command };
	}

	return { action: "none" };
}
