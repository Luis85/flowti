/**
 * vault-service.ts — Obsidian CLI wrapper for vault content browsing.
 *
 * Provides detection, folder listing, file reading, and search
 * through the Obsidian CLI (1.12+). All operations are read-only.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { VAULT_ROOT } from "../../infrastructure/config.js";

let _cliAvailable: boolean | null = null;

export function isCliAvailable(): boolean {
	if (_cliAvailable !== null) return _cliAvailable;
	try {
		execFileSync("obsidian", ["version"], {
			encoding: "utf-8",
			timeout: 3000,
			windowsHide: true,
		});
		_cliAvailable = true;
	} catch {
		_cliAvailable = false;
	}
	return _cliAvailable;
}

export function isVaultInitialized(): boolean {
	return fs.existsSync(path.join(VAULT_ROOT, ".obsidian"));
}

export function listFolder(folderPath: string): { name: string; isDir: boolean }[] {
	const abs = path.join(VAULT_ROOT, folderPath);
	if (!fs.existsSync(abs)) return [];
	const entries = fs.readdirSync(abs, { withFileTypes: true });
	return entries
		.filter((e) => !e.name.startsWith("."))
		.map((e) => ({ name: e.name, isDir: e.isDirectory() }))
		.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
}

export function readMarkdownFile(filePath: string): string | null {
	const abs = path.join(VAULT_ROOT, filePath);
	if (!fs.existsSync(abs)) return null;
	return fs.readFileSync(abs, "utf-8");
}

export function searchVault(query: string): string[] {
	try {
		const output = execFileSync("obsidian", ["search", `query=${query}`, "format=json"], {
			encoding: "utf-8",
			timeout: 10_000,
			windowsHide: true,
		});
		const results = JSON.parse(output.trim()) as Array<string | { path: string }>;
		return results.map((r) => (typeof r === "string" ? r : r.path));
	} catch {
		// Fallback: simple filesystem grep
		return filesystemSearch(query);
	}
}

function matchesMdFile(fullPath: string, name: string, lowerQuery: string): boolean {
	if (name.toLowerCase().includes(lowerQuery)) return true;
	try {
		const content = fs.readFileSync(fullPath, "utf-8");
		return content.toLowerCase().includes(lowerQuery);
	} catch { return false; }
}

function filesystemSearch(query: string): string[] {
	const matches: string[] = [];
	const lowerQuery = query.toLowerCase();

	function walk(dir: string, rel: string): void {
		if (matches.length >= 50) return;
		let entries: fs.Dirent[];
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
		catch { return; }

		for (const e of entries) {
			if (e.name.startsWith(".") || e.name === "node_modules") continue;
			const fullPath = path.join(dir, e.name);
			const relPath = rel ? `${rel}/${e.name}` : e.name;
			if (e.isDirectory()) {
				walk(fullPath, relPath);
			} else if (e.name.endsWith(".md") && matchesMdFile(fullPath, e.name, lowerQuery)) {
				matches.push(relPath);
			}
		}
	}

	walk(VAULT_ROOT, "");
	return matches;
}
