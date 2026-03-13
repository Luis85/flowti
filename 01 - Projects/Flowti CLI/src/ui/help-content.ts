/**
 * help-content.ts — Lazy-loaded help content from vault markdown files.
 *
 * Reads help pages from 03 - Resources/Documentation/Help/ at runtime,
 * renders markdown to ANSI for terminal display, and caches per-section.
 */

import { HELP_DIR } from "../infrastructure/config.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { renderMarkdownToAnsi } from "../infrastructure/markdown-ansi.js";
import { loadHelpSection, listHelpSections } from "../domain/shared/help-loader.js";

const loaderDeps = { disk, paths };

/** Get rendered ANSI help content for a section. Returns null if unavailable. */
export function getHelp(section: string): string | null {
	const markdown = loadHelpSection(HELP_DIR, section, loaderDeps);
	if (markdown === null) return null;
	return renderMarkdownToAnsi(markdown);
}

/** List all available help section names. */
export function getHelpSections(): string[] {
	return listHelpSections(HELP_DIR, loaderDeps);
}
