/**
 * fs.ts — File system utilities for scaffolding and report parsing.
 */

import { paths } from "./paths.js";
import { disk } from "./filesystem.js";
import { RESET, GREEN, YELLOW } from "./ui.js";
import { log } from "./logger.js";
import type { IFileSystem } from "./types.js";

export function writeFileAt(basePath: string, relPath: string, content: string, fs: IFileSystem = disk): boolean {
	const absPath = paths.join(basePath, relPath);
	const dir = paths.dirname(absPath);
	fs.mkdirSync(dir, { recursive: true });
	if (fs.existsSync(absPath)) {
		log(`    ${YELLOW}skip${RESET}  ${relPath} (already exists)`);
		return false;
	}
	fs.writeFileSync(absPath, content, "utf-8");
	log(`    ${GREEN}create${RESET}  ${relPath}`);
	return true;
}

export function countFiles(dir: string, ext: string, fs: IFileSystem = disk): number {
	let count = 0;
	try {
		const walk = (d: string): void => {
			for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				const full = paths.join(d, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.isFile() && full.endsWith(ext)) count++;
			}
		};
		walk(dir);
	} catch { /* ignore */ }
	return count;
}

export function findLatestReport(dir: string, fs: IFileSystem = disk): string | null {
	if (!fs.existsSync(dir)) return null;
	const files = fs.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && !f.startsWith("."))
		.sort()
		.reverse();
	return files.length > 0 ? paths.join(dir, files[0]) : null;
}

export function parseFrontmatter(filePath: string, fs: IFileSystem = disk): Record<string, string> {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return {};

		const result: Record<string, string> = {};
		for (const line of match[1].split("\n")) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1 || line.startsWith("#") || line.startsWith("  -")) continue;
			const key = line.substring(0, colonIdx).trim();
			let value = line.substring(colonIdx + 1).trim();
			if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
			result[key] = value;
		}
		return result;
	} catch {
		return {};
	}
}
