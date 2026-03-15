/**
 * markdown-utils.ts — Shared utilities for markdown-based stores (infrastructure layer).
 *
 * Extracted from domain/shared/markdown-store.ts so the store engine
 * (infrastructure) can use them without violating the layer-direction rule
 * (Infrastructure MUST NOT import from Domain).
 */

import type { CliDeps } from "./deps.js";

const MD_EXT = ".md";

export type StoreDeps = Pick<CliDeps, "disk" | "paths">;

function toKebab(name: string): string {
	return name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

/** List all .md files in a directory. Returns [] if the directory does not exist. */
export function listMdFiles(deps: StoreDeps, dir: string): string[] {
	if (!deps.disk.existsSync(dir)) return [];
	return deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(MD_EXT));
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
