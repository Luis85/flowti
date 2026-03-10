/**
 * make.controller.ts — Controller for in-project scaffolding commands.
 *
 * Aggregates component commands and edit commands from the make domain.
 * These are already well-structured — this controller delegates directly.
 */

import type { CommandHandler } from "../infrastructure/types.js";
import { commands as componentCommands } from "../domain/make/component/component-commands.js";
import { commands as editCommands } from "../domain/make/component/component-edit.js";

// Make commands already follow the CommandHandler signature.
// They are thin wrappers around pure plan functions + file writers,
// so there's no Request/Response lift needed here yet.

export const commands: Record<string, CommandHandler> = {
	...componentCommands,
	...editCommands,
};
