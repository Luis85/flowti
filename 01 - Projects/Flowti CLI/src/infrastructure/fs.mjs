/**
 * fs.mjs — File system utilities for scaffolding and report parsing.
 */

import fsNode from "node:fs";
import path from "node:path";
import { ROOT } from "./config.mjs";
import { RESET, GREEN, YELLOW } from "./ui.mjs";

export function writeFile(relPath, content) {
	const absPath = path.join(ROOT, relPath);
	const dir = path.dirname(absPath);
	fsNode.mkdirSync(dir, { recursive: true });
	if (fsNode.existsSync(absPath)) {
		console.log(`    ${YELLOW}skip${RESET}  ${relPath} (already exists)`);
		return false;
	}
	fsNode.writeFileSync(absPath, content, "utf-8");
	console.log(`    ${GREEN}create${RESET}  ${relPath}`);
	return true;
}

export function countFiles(dir, ext) {
	let count = 0;
	try {
		const walk = (d) => {
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

export function findLatestReport(dir) {
	if (!fsNode.existsSync(dir)) return null;
	const files = fsNode.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && !f.startsWith("."))
		.sort()
		.reverse();
	return files.length > 0 ? path.join(dir, files[0]) : null;
}

export function parseFrontmatter(filePath) {
	try {
		const content = fsNode.readFileSync(filePath, "utf-8");
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return {};

		const result = {};
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
