/**
 * help.controller.ts — Controller for the help command.
 *
 * Help display is inherently a view concern — showHelp lives in ui/help.ts.
 * This controller simply delegates.
 */

import type { CommandHandler } from "../infrastructure/types.js";
import { showHelp } from "../ui/help.js";

export const commands: Record<string, CommandHandler> = {
	help: (flags, rawArgs) => {
		showHelp(Object.keys(flags)[0] ?? rawArgs?.[1] ?? "main");
	},
};
