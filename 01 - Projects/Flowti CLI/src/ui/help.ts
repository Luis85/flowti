/**
 * help.ts — CLI help system (man-pages).
 *
 * Help content is loaded from vault markdown files via help-content.ts.
 * This module provides the renderHelp() renderer, showHelp() convenience
 * function, and commands.
 */

import { RESET, DIM, YELLOW } from "../infrastructure/ui.js";
import { getHelp, getHelpSections } from "./help-content.js";
import type { HelpLoaderDeps } from "../domain/shared/help-loader.js";

export interface HelpModel {
	section: string;
	content: string | null;
	availableSections: string[];
}

/** Deps required by help rendering. */
export type HelpDeps = HelpLoaderDeps & { log: (msg?: string) => void };

/** Renderer for the help controller's HelpModel. */
export function renderHelp(model: HelpModel, log: (msg?: string) => void): void {
	if (model.content) {
		log(model.content);
	} else {
		log(`\n  ${YELLOW}No help available for "${model.section}".${RESET}`);
		log(`  ${DIM}Available sections: ${model.availableSections.join(", ")}${RESET}\n`);
	}
}

/** Show help for a given section (convenience wrapper around renderHelp). */
export function showHelp(section: string | undefined, deps: HelpDeps): void {
	const key = section?.toLowerCase() ?? "main";
	renderHelp({ section: key, content: getHelp(key, deps), availableSections: getHelpSections(deps) }, deps.log);
}
