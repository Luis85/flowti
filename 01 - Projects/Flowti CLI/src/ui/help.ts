/**
 * help.ts — CLI help system (man-pages).
 *
 * Help content is loaded from vault markdown files via help-content.ts.
 * This module provides the renderHelp() renderer, showHelp() convenience
 * function, and commands.
 */

import { RESET, DIM, YELLOW } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import { getHelp, getHelpSections } from "./help-content.js";

export interface HelpModel {
	section: string;
	content: string | null;
	availableSections: string[];
}

/** Renderer for the help controller's HelpModel. */
export function renderHelp(model: HelpModel): void {
	if (model.content) {
		log(model.content);
	} else {
		log(`\n  ${YELLOW}No help available for "${model.section}".${RESET}`);
		log(`  ${DIM}Available sections: ${model.availableSections.join(", ")}${RESET}\n`);
	}
}

/** Show help for a given section (convenience wrapper around renderHelp). */
export function showHelp(section?: string): void {
	const key = section?.toLowerCase() ?? "main";
	renderHelp({ section: key, content: getHelp(key), availableSections: getHelpSections() });
}

/** Legacy help commands — used by main.ts and tests. */
export const commands = {
	help: (flags: Record<string, string | boolean>, rawArgs: string[]) => {
		showHelp(Object.keys(flags)[0] ?? rawArgs?.[1] ?? "main");
	},
};
