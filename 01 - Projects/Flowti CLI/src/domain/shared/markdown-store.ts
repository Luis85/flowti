/**
 * markdown-store.ts — Shared utilities for markdown-based domain stores.
 *
 * Extracts the common patterns from 7 store implementations
 * (capa, deliverables, lifecycle, raid, requirements, resources, timelog).
 */

import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";

const MD_EXT = ".md";

export type StoreDeps = Pick<CliDeps, "disk" | "paths">;

/** List all .md files in a directory. Returns [] if the directory does not exist. */
export function listMdFiles(deps: StoreDeps, dir: string): string[] {
	if (!deps.disk.existsSync(dir)) return [];
	return deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(MD_EXT));
}

/** Read a .md file and parse its YAML frontmatter as string key-value pairs. */
export function readFrontmatter(deps: StoreDeps, dir: string, file: string): Record<string, string> {
	const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
	return parseFrontmatterStrings(content);
}

/** List items by scanning .md files, parsing frontmatter, and mapping to domain summaries. */
export function listItems<T>(
	deps: StoreDeps,
	dir: string,
	parser: (fm: Record<string, string>, file: string) => T,
	sortFn?: (a: T, b: T) => number,
): T[] {
	const files = listMdFiles(deps, dir);
	const items = files.map((file) => parser(readFrontmatter(deps, dir, file), file));
	return sortFn ? items.sort(sortFn) : items;
}

/** Resolve a store directory from project path and optional config dir. */
export function resolveDir(deps: Pick<CliDeps, "paths">, projectPath: string, configDir: string | undefined, defaultDir: string): string {
	return deps.paths.join(projectPath, configDir ?? defaultDir);
}

/** Build a kebab-case .md filename from a name. */
export function toMdFilename(name: string): string {
	return toKebab(name) + MD_EXT;
}

/** Update a single frontmatter field in a .md file by regex replacement. Returns true if successful. */
export function updateField(deps: StoreDeps, filePath: string, field: string, value: string): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(new RegExp(`^${field}:\\s*.+$`, "m"), `${field}: ${value}`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Append a bullet item under a markdown section heading. */
export function appendToSection(deps: Pick<CliDeps, "disk">, filePath: string, sectionTitle: string, line: string): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const sectionRegex = new RegExp(`(^## ${sectionTitle}\\s*\\n)`, "m");
	if (!sectionRegex.test(content)) return false;
	const commentRegex = new RegExp(`(^## ${sectionTitle}\\s*\\n(?:\\s*\\n)*)<!-- .* -->`, "m");
	if (commentRegex.test(content)) {
		content = content.replace(commentRegex, `$1- ${line}`);
	} else {
		content = content.replace(sectionRegex, `$1\n- ${line}\n`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Replace or remove a bullet/checklist line in a markdown section by index (0-based). */
export function replaceSectionLine(
	deps: Pick<CliDeps, "disk">,
	filePath: string,
	sectionTitle: string,
	index: number,
	transform: (done: boolean, text: string) => string | null,
): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	const content = deps.disk.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");

	let inSection = false;
	let itemIdx = 0;
	for (let i = 0; i < lines.length; i++) {
		if (new RegExp(`^## ${sectionTitle}\\s*$`).test(lines[i])) { inSection = true; continue; }
		if (inSection && /^## /.test(lines[i])) break;
		if (inSection && /^\s*-\s+/.test(lines[i])) {
			if (itemIdx === index) {
				const done = /^\s*-\s+\[x\]\s+/i.test(lines[i]);
				const text = lines[i].replace(/^\s*-\s+(\[.\]\s+)?/, "").trim();
				const replacement = transform(done, text);
				if (replacement === null) {
					lines.splice(i, 1);
				} else {
					lines[i] = replacement;
				}
				deps.disk.writeFileSync(filePath, lines.join("\n"), "utf-8");
				return true;
			}
			itemIdx++;
		}
	}
	return false;
}
