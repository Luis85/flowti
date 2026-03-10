/**
 * help.ts — CLI help system (man-pages).
 *
 * Help content is in help-content.ts. This module provides the
 * showHelp() function and commands.help handler.
 */

import { RESET, DIM, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import { HELP } from "./help-content.js";

export { HELP };

export function showHelp(section?: string): void {
	const key = section?.toLowerCase() ?? "main";
	const content = HELP[key];
	if (!content) {
		log(`\n  ${YELLOW}No help available for "${section}".${RESET}`);
		log(`  ${DIM}Available sections: ${Object.keys(HELP).join(", ")}${RESET}\n`);
		return;
	}
	log(content);
}

export const commands = {
	help: (flags: Record<string, string | boolean>, rawArgs: string[]) => {
		showHelp(Object.keys(flags)[0] ?? rawArgs?.[1] ?? "main");
	},
};
