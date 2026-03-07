/**
 * fs.ts — File system utilities for scaffolding and report parsing.
 */

import fsNode from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { RESET, GREEN, YELLOW } from "./ui.js";
import { log } from "./logger.js";

export function writeFile(relPath: string, content: string): boolean {
	return writeFileAt(ROOT, relPath, content);
}

export function writeFileAt(basePath: string, relPath: string, content: string): boolean {
	const absPath = path.join(basePath, relPath);
	const dir = path.dirname(absPath);
	fsNode.mkdirSync(dir, { recursive: true });
	if (fsNode.existsSync(absPath)) {
		log(`    ${YELLOW}skip${RESET}  ${relPath} (already exists)`);
		return false;
	}
	fsNode.writeFileSync(absPath, content, "utf-8");
	log(`    ${GREEN}create${RESET}  ${relPath}`);
	return true;
}

export function countFiles(dir: string, ext: string): number {
	let count = 0;
	try {
		const walk = (d: string): void => {
			for (const entry of fsNode.readdirSync(d, { withFileTypes: true })) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				const full = path.join(d, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.isFile() && full.endsWith(ext)) count++;
			}
		};
		walk(dir);
	} catch { /* ignore */ }
	return count;
}

export function findLatestReport(dir: string): string | null {
	if (!fsNode.existsSync(dir)) return null;
	const files = fsNode.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && !f.startsWith("."))
		.sort()
		.reverse();
	return files.length > 0 ? path.join(dir, files[0]) : null;
}

export function parseFrontmatter(filePath: string): Record<string, string> {
	try {
		const content = fsNode.readFileSync(filePath, "utf-8");
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
