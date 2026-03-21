/**
 * Scan vault `03 - Resources/Agents` for Agent markdown notes (filesystem).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { VaultAgentSummary } from "./types.js";

const DEFAULT_AGENTS_DIR = "03 - Resources/Agents";

/** Extract `type` and `name` from YAML frontmatter (Agent notes only). */
export function parseAgentTypeAndName(md: string): { name: string } | null {
	const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;
	const block = match[1];
	const typeM = block.match(/^type:\s*(.+)$/m);
	if (!typeM || typeM[1].trim() !== "Agent") return null;
	const nameM = block.match(/^name:\s*(.+)$/m);
	if (!nameM) return null;
	const raw = nameM[1].trim().replace(/^["']|["']$/g, "");
	return raw ? { name: raw } : null;
}

function collectMarkdownPaths(agentsAbsDir: string): string[] {
	const paths: string[] = [];
	if (!existsSync(agentsAbsDir)) return paths;
	let names: string[];
	try {
		names = readdirSync(agentsAbsDir);
	} catch {
		return paths;
	}
	for (const name of names) {
		if (name === "output" || name.startsWith(".")) continue;
		const abs = join(agentsAbsDir, name);
		let st;
		try {
			st = statSync(abs);
		} catch {
			continue;
		}
		if (st.isFile()) {
			if (name.endsWith(".md") && !name.endsWith(".prompt.md")) paths.push(abs);
		} else if (st.isDirectory()) {
			let subNames: string[];
			try {
				subNames = readdirSync(abs);
			} catch {
				continue;
			}
			for (const sub of subNames) {
				if (!sub.endsWith(".md") || sub.endsWith(".prompt.md")) continue;
				paths.push(join(abs, sub));
			}
		}
	}
	return paths.sort((a, b) => a.localeCompare(b));
}

/** List Agent definitions under the vault agents folder. */
export function listVaultAgentSummaries(vaultBasePath: string, relativeDir = DEFAULT_AGENTS_DIR): VaultAgentSummary[] {
	const absDir = join(vaultBasePath, relativeDir);
	const out: VaultAgentSummary[] = [];
	for (const filePath of collectMarkdownPaths(absDir)) {
		try {
			const content = readFileSync(filePath, "utf-8");
			const meta = parseAgentTypeAndName(content);
			if (!meta) continue;
			const rel = filePath.slice(vaultBasePath.length).replace(/^[/\\]/, "").split(/[/\\]/).join("/");
			out.push({ name: meta.name, path: rel });
		} catch {
			/* skip */
		}
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}
