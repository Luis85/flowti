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
		return { action: "help", section: Object.keys(flags)[0] ?? rawArgs[1] ?? "main" };
	}

	if (command && command in handlers) {
		const handler = handlers[command];
		if (!project && !projectFreeSet.has(command)) {
			return { action: "no-project", command };
		}
		return { action: "run", handler, command, project: project ?? undefined };
	}

	if (command?.startsWith("report:") && wildcardHandler) {
		if (!project) {
			return { action: "no-project", command };
		}
		return { action: "run", handler: wildcardHandler, command, project };
	}

	if (command) {
		return { action: "unknown", command };
	}

	return { action: "none" };
}
