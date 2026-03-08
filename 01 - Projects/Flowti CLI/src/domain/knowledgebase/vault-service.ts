/**
 * vault-service.ts — Obsidian CLI wrapper for vault content browsing.
 *
 * Provides detection, folder listing, file reading, and search
 * through the Obsidian CLI (1.12+). All operations are read-only.
 */

import { shell } from "../../infrastructure/shell.js";
import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";

let _cliAvailable: boolean | null = null;

export function isCliAvailable(): boolean {
	if (_cliAvailable !== null) return _cliAvailable;
	_cliAvailable = shell.execFile("obsidian", ["version"], { timeout: 3000 }) !== null;
	return _cliAvailable;
}

export function isVaultInitialized(): boolean {
	return disk.existsSync(paths.join(VAULT_ROOT, ".obsidian"));
}

export function listFolder(folderPath: string): { name: string; isDir: boolean }[] {
	const abs = paths.join(VAULT_ROOT, folderPath);
	if (!disk.existsSync(abs)) return [];
	const entries = disk.readdirSync(abs, { withFileTypes: true });
	return entries
		.filter((e) => !e.name.startsWith("."))
		.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
		.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
}

export function readMarkdownFile(filePath: string): string | null {
	const abs = paths.join(VAULT_ROOT, filePath);
	if (!disk.existsSync(abs)) return null;
	return disk.readFileSync(abs, "utf-8");
}

export function searchVault(query: string): string[] {
	const output = shell.execFile("obsidian", ["search", `query=${query}`, "format=json"]);
	if (!output) return [];
	try {
		const results = JSON.parse(output) as Array<string | { path: string }>;
		return results.map((r) => (typeof r === "string" ? r : r.path));
	} catch {
		return [];
	}
}
