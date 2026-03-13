/**
 * vault-service.ts — Obsidian CLI wrapper for vault content browsing.
 *
 * Provides detection, folder listing, file reading, and search
 * through the Obsidian CLI (1.12+). All operations are read-only.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

let _cliAvailable: boolean | null = null;

export function isCliAvailable(deps: Pick<CliDeps, "shell">): boolean {
	if (_cliAvailable !== null) return _cliAvailable;
	_cliAvailable = deps.shell.execFile("obsidian", ["version"], { timeout: 3000 }) !== null;
	return _cliAvailable;
}

/** Reset the cached CLI availability flag (for testing). */
export function resetCliAvailableCache(): void {
	_cliAvailable = null;
}

export function isVaultInitialized(vaultRoot: string, deps: Pick<CliDeps, "disk" | "paths">): boolean {
	return deps.disk.existsSync(deps.paths.join(vaultRoot, ".obsidian"));
}

export function listFolder(folderPath: string, vaultRoot: string, deps: Pick<CliDeps, "disk" | "paths">): { name: string; isDir: boolean }[] {
	const abs = deps.paths.join(vaultRoot, folderPath);
	if (!deps.disk.existsSync(abs)) return [];
	const entries = deps.disk.readdirSync(abs, { withFileTypes: true });
	return entries
		.filter((e) => !e.name.startsWith("."))
		.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
		.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
}

export function readMarkdownFile(filePath: string, vaultRoot: string, deps: Pick<CliDeps, "disk" | "paths">): string | null {
	const abs = deps.paths.join(vaultRoot, filePath);
	if (!deps.disk.existsSync(abs)) return null;
	return deps.disk.readFileSync(abs, "utf-8");
}

export function searchVault(query: string, deps: Pick<CliDeps, "shell">): string[] {
	const output = deps.shell.execFile("obsidian", ["search", `query=${query}`, "format=json"]);
	if (!output) return [];
	try {
		const results = JSON.parse(output) as Array<string | { path: string }>;
		return results.map((r) => (typeof r === "string" ? r : r.path));
	} catch {
		return [];
	}
}
