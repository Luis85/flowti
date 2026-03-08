/**
 * frontmatter.ts — Shared YAML frontmatter parsing and serialization.
 *
 * Single source of truth for all frontmatter operations in the CLI.
 * Provides three levels of parsing:
 *   - parseFrontmatterContent  → typed scalars + arrays (Record<string, unknown>)
 *   - parseFrontmatterStrings  → string-only values (Record<string, string>)
 *   - splitFrontmatter         → string values + body separation
 * And serialization:
 *   - joinFrontmatter          → Record<string, string> + body → markdown string
 */

// ── Shared regex ────────────────────────────────────────────────────

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;
const KV_REGEX = /^(\w[\w_]*)\s*:\s*(.*)$/;

function stripQuotes(value: string): string {
	return value.replace(/^["']|["']$/g, "");
}

// ── Typed parser (scalars + arrays) ─────────────────────────────────

export function parseScalar(rawValue: string): unknown {
	if (rawValue === "true") return true;
	if (rawValue === "false") return false;
	if (/^-?\d+$/.test(rawValue)) return parseInt(rawValue, 10);
	if (/^-?\d+\.\d+$/.test(rawValue)) return parseFloat(rawValue);
	return stripQuotes(rawValue);
}

export function parseFrontmatterContent(content: string): Record<string, unknown> | null {
	const match: RegExpMatchArray | null = content.match(FM_REGEX);
	if (!match) return null;

	const fm: Record<string, unknown> = {};
	const lines: string[] = match[1].split(/\r?\n/);
	let currentKey: string | null = null;
	let inArray: boolean = false;

	for (const line of lines) {
		if (inArray && /^\s+-\s+/.test(line)) {
			const value: string = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
			(fm[currentKey!] as string[]).push(value);
			continue;
		}

		const kvMatch: RegExpMatchArray | null = line.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) { inArray = false; continue; }

		const key: string = kvMatch[1];
		const rawValue: string = kvMatch[2].trim();

		if (rawValue === "" || rawValue === "[]") {
			currentKey = key;
			fm[key] = [];
			inArray = rawValue === "";
			continue;
		}

		inArray = false;
		currentKey = null;
		fm[key] = parseScalar(rawValue);
	}

	return fm;
}

// ── String-only parser ──────────────────────────────────────────────

/** Parse frontmatter fields as string key-value pairs, stripping quotes. */
export function parseFrontmatterStrings(content: string): Record<string, string> {
	const match = content.match(FM_REGEX);
	if (!match) return {};

	const fm: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kvMatch = line.match(KV_REGEX);
		if (kvMatch) fm[kvMatch[1]] = stripQuotes(kvMatch[2]);
	}
	return fm;
}

// ── Split parser (frontmatter + body) ───────────────────────────────

export interface SplitFrontmatter {
	frontmatter: Record<string, string>;
	body: string;
}

/** Parse frontmatter and separate the body content. Returns null if no frontmatter found. */
export function splitFrontmatter(content: string): SplitFrontmatter | null {
	const match = content.match(FM_REGEX);
	if (!match) return null;

	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kvMatch = line.match(KV_REGEX);
		if (kvMatch) frontmatter[kvMatch[1]] = stripQuotes(kvMatch[2]);
	}

	const body = content.slice(match[0].length);
	return { frontmatter, body };
}

// ── Serializer ──────────────────────────────────────────────────────

/** Serialize a frontmatter object and body back to a markdown string with YAML block. */
export function joinFrontmatter(fm: Record<string, string>, body: string): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		lines.push(`${key}: ${value}`);
	}
	lines.push("---");
	return lines.join("\n") + body;
}
