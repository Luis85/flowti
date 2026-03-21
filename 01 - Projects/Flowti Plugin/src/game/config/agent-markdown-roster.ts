/**
 * Parse agent definition markdown (YAML frontmatter, `type: Agent`) and build
 * {@link DashboardAgent} rows — same source as the agent sidepanel
 * (`03 - Resources/Agents`).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AgentType, AgentAttributes, DashboardAgent } from "../data/types.js";

/** Default vault-relative folder for agent `.md` definitions (matches sidepanel). */
export const DEFAULT_AGENTS_MARKDOWN_DIR = "03 - Resources/Agents";

/** Parse YAML frontmatter from a markdown string. Returns key-value pairs. */
export function parseFrontmatter(md: string): Record<string, unknown> {
	const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};
	const result: Record<string, unknown> = {};
	let currentKey = "";
	let currentList: string[] | null = null;
	const indent2: Record<string, Record<string, unknown>> = {};
	let indent2Key = "";

	for (const line of match[1].split(/\r?\n/)) {
		if (tryParseNestedLine(line, indent2Key, indent2)) continue;
		if (tryParseListItem(line, currentList)) continue;

		if (currentList) {
			result[currentKey] = currentList;
			currentList = null;
		}

		const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
		if (kvMatch) {
			currentKey = kvMatch[1];
			const val = kvMatch[2].trim();
			if (val === "") {
				currentList = [];
				indent2Key = currentKey;
			} else {
				const cleaned = val.replace(/^["']|["']$/g, "").replace(/^\[\[|\]\]$/g, "");
				result[currentKey] = /^\d+$/.test(cleaned) ? Number(cleaned) : cleaned;
				indent2Key = "";
			}
		}
	}
	if (currentList) result[currentKey] = currentList;
	for (const [k, v] of Object.entries(indent2)) {
		if (Object.keys(v).length > 0) result[k] = v;
	}
	return result;
}

/** Try to parse a nested (2-space indent) key-value line. Returns true if consumed. */
function tryParseNestedLine(line: string, indent2Key: string, indent2: Record<string, Record<string, unknown>>): boolean {
	const nestedMatch = line.match(/^ {2}(\w+):\s*(.+)$/);
	if (!nestedMatch || !indent2Key) return false;
	if (!indent2[indent2Key]) indent2[indent2Key] = {};
	const val = nestedMatch[2].trim();
	indent2[indent2Key][nestedMatch[1]] = /^\d+$/.test(val) ? Number(val) : val;
	return true;
}

/** Try to parse a list item line. Returns true if consumed. */
function tryParseListItem(line: string, currentList: string[] | null): boolean {
	const listMatch = line.match(/^\s+-\s+(.+)$/);
	if (!listMatch || !currentList) return false;
	currentList.push(listMatch[1]);
	return true;
}

/** Parse a pipe-delimited suggestedTask string into a structured object. */
export function parseSuggestedTask(raw: string): {
	name: string;
	phases: string[];
	input?: { type: "text"; prompt: string };
	tool?: { command: string };
} {
	const segments = raw.split("|");
	const name = segments[0].trim();
	const phases = segments.length > 1
		? segments[1].split(",").map((s) => s.trim()).filter(Boolean)
		: [];

	let input: { type: "text"; prompt: string } | undefined;
	let tool: { command: string } | undefined;

	for (let i = 2; i < segments.length; i++) {
		const seg = segments[i].trim();
		if (seg.startsWith("input:")) {
			const rest = seg.slice(6);
			const colonIdx = rest.indexOf(":");
			if (colonIdx !== -1) {
				input = { type: "text", prompt: rest.slice(colonIdx + 1) };
			}
		} else if (seg.startsWith("tool:")) {
			tool = { command: seg.slice(5) };
		}
	}

	return { name, phases, ...(input && { input }), ...(tool && { tool }) };
}

function parseSkills(raw: unknown): readonly { name: string; level: string }[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const skills = (raw as unknown[])
		.filter((x): x is string => typeof x === "string")
		.map((s) => {
			const [name, level] = s.split("|").map((p) => p.trim());
			return { name, level: level || "unknown" };
		});
	return skills.length > 0 ? skills : undefined;
}

function parseDashboardStatus(raw: unknown): DashboardAgent["status"] {
	const s = typeof raw === "string" ? raw.toLowerCase() : "";
	if (s === "busy" || s === "working") return "busy";
	if (s === "unassigned") return "unassigned";
	return "idle";
}

function normalizeAttributes(attrs: unknown): AgentAttributes | undefined {
	if (!attrs || typeof attrs !== "object") return undefined;
	const o = attrs as Record<string, unknown>;
	const out: Record<string, number> = {};
	for (const k of ["str", "int", "wis", "cha", "dex", "con"] as const) {
		const v = o[k];
		if (typeof v === "number") out[k] = v;
	}
	return Object.keys(out).length > 0 ? (out as AgentAttributes) : undefined;
}

/** Extract a string array from an unknown field, filtering to string elements. */
function extractStringArray(raw: unknown): readonly string[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const filtered = (raw as unknown[]).filter((x): x is string => typeof x === "string");
	return filtered.length > 0 ? filtered : undefined;
}

/** Extract a non-empty string value from an unknown field. */
function extractString(raw: unknown): string | undefined {
	return typeof raw === "string" ? raw : undefined;
}

/** Build the optional spread properties for a DashboardAgent. */
function buildOptionalFields(fm: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const personality = extractStringArray(fm.personality);
	if (personality) result.personality = personality;
	const attributes = normalizeAttributes(fm.attributes);
	if (attributes) result.attributes = attributes;
	const behaviors = extractStringArray(fm.behaviors);
	if (behaviors) result.behaviors = behaviors;
	const skills = parseSkills(fm.skills);
	if (skills) result.skills = skills;
	if (typeof fm.experience === "number") result.experience = fm.experience;
	if (Array.isArray(fm.suggestedTasks)) {
		const tasks = (fm.suggestedTasks as string[]).map(parseSuggestedTask);
		if (tasks.length > 0) result.suggestedTasks = tasks;
	}
	return result;
}

/**
 * Map parsed frontmatter to a dashboard row when `type === "Agent"` and `name` is set.
 */
export function dashboardAgentFromFrontmatter(fm: Record<string, unknown>): DashboardAgent | null {
	if (fm.type !== "Agent") return null;
	const name = String(fm.name ?? "").trim();
	if (!name) return null;

	return {
		name,
		agentType: (fm.agentType === "ai" || fm.agentType === "npc") ? (fm.agentType as AgentType) : "human" as AgentType,
		domain: extractString(fm.domain),
		status: parseDashboardStatus(fm.status),
		persona: extractString(fm.persona),
		mood: extractString(fm.mood),
		...buildOptionalFields(fm),
	};
}

/**
 * Collect `.md` paths under the agents folder: top-level files and one level of
 * subfolders (skips `output` and dotfiles; excludes `*.prompt.md`).
 */
export function collectAgentMarkdownPaths(agentsAbsDir: string): string[] {
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

/**
 * Load {@link DashboardAgent} rows from vault agent definition markdown files
 * (filesystem). Used when `agent-dashboard.json` is missing/empty and the vault
 * is available on disk (desktop).
 */
export function dashboardAgentsFromAgentsMarkdownDir(
	vaultBasePath: string,
	relativeAgentsDir: string = DEFAULT_AGENTS_MARKDOWN_DIR,
): DashboardAgent[] {
	if (!vaultBasePath) return [];
	const absDir = join(vaultBasePath, relativeAgentsDir);
	const byName = new Map<string, DashboardAgent>();
	for (const filePath of collectAgentMarkdownPaths(absDir)) {
		try {
			const content = readFileSync(filePath, "utf-8");
			const fm = parseFrontmatter(content);
			let row = dashboardAgentFromFrontmatter(fm);
			if (!row) continue;

			// Load companion JSON (same basename, .json extension)
			const jsonPath = filePath.replace(/\.md$/, ".json");
			if (existsSync(jsonPath)) {
				try {
					const jsonRaw = readFileSync(jsonPath, "utf-8");
					const companion = JSON.parse(jsonRaw) as Record<string, unknown>;
					if (Array.isArray(companion.goals)) {
						const goals = (companion.goals as Array<{ name?: string; priority?: number }>)
							.filter((g) => typeof g.name === "string")
							.map((g) => ({ text: g.name!, priority: String(g.priority ?? 0) }));
						if (goals.length > 0) {
							row = { ...row, goals };
						}
					}
				} catch { /* skip unreadable JSON */ }
			}

			byName.set(row.name, row);
		} catch {
			/* skip unreadable */
		}
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
