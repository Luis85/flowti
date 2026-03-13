/**
 * help-loader.ts — Load help content from markdown files on disk.
 *
 * Pure domain function with DI deps. Reads markdown from a help directory,
 * caches per-section for the lifetime of the process.
 */

import type { IFileSystem } from "../../infrastructure/types.js";
import type { IPaths } from "../../infrastructure/types.js";

export interface HelpLoaderDeps {
	disk: Pick<IFileSystem, "existsSync" | "readFileSync" | "readdirSync">;
	paths: Pick<IPaths, "join" | "basename">;
}

const cache = new Map<string, string>();

/** Load a single help section by name. Returns null if file missing. */
export function loadHelpSection(helpDir: string, section: string, deps: HelpLoaderDeps): string | null {
	const cached = cache.get(section);
	if (cached !== undefined) return cached;

	const filePath = deps.paths.join(helpDir, `${section}.md`);
	if (!deps.disk.existsSync(filePath)) return null;

	const content = deps.disk.readFileSync(filePath, "utf-8");
	cache.set(section, content);
	return content;
}

/** List available help sections (filenames without .md extension). */
export function listHelpSections(helpDir: string, deps: HelpLoaderDeps): string[] {
	if (!deps.disk.existsSync(helpDir)) return [];
	const entries = deps.disk.readdirSync(helpDir);
	return entries
		.filter((f: string) => f.endsWith(".md"))
		.map((f: string) => deps.paths.basename(f, ".md"));
}

/** Clear the help cache (for testing). */
export function clearHelpCache(): void {
	cache.clear();
}
