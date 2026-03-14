/**
 * help-content.ts — Lazy-loaded help content from vault markdown files.
 *
 * Reads help pages from 03 - Resources/Documentation/Help/ at runtime,
 * renders markdown to ANSI for terminal display, and caches per-section.
 */

import { HELP_DIR } from "../infrastructure/config.js";
import { renderMarkdownToAnsi } from "../infrastructure/markdown-ansi.js";
import { loadHelpSection, listHelpSections } from "../domain/shared/help-loader.js";
import type { HelpLoaderDeps } from "../domain/shared/help-loader.js";

/** Get rendered ANSI help content for a section. Returns null if unavailable. */
export function getHelp(section: string, deps: HelpLoaderDeps): string | null {
	const markdown = loadHelpSection(HELP_DIR, section, deps);
	if (markdown === null) return null;
	return renderMarkdownToAnsi(markdown);
}

/** List all available help section names. */
export function getHelpSections(deps: HelpLoaderDeps): string[] {
	return listHelpSections(HELP_DIR, deps);
}
