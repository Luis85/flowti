/**
 * frontmatter.ts — Domain-level YAML frontmatter parser and serializer.
 *
 * Provides lightweight frontmatter handling for vault operations without
 * importing infrastructure. Zero dependencies — pure string manipulation.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ParsedFrontmatter {
	readonly frontmatter: Record<string, unknown>;
	readonly body: string;
}

// ── Internal helpers ─────────────────────────────────────────────────

function parseValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (trimmed === "null") return null;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function needsQuoting(value: string): boolean {
	return /[:#'"]/.test(value);
}

function serializeValue(value: unknown): string {
	if (typeof value === "string" && needsQuoting(value)) {
		return `"${value}"`;
	}
	return String(value);
}

// ── Public API ───────────────────────────────────────────────────────

/** Parse YAML frontmatter delimited by `---` from markdown content. */
export function parseFrontmatter(content: string): ParsedFrontmatter {
	content = content.replace(/\r\n/g, "\n");
	if (!content.startsWith("---")) {
		return { frontmatter: {}, body: content };
	}

	const endIndex = content.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { frontmatter: {}, body: content };
	}

	const yamlBlock = content.slice(4, endIndex);
	const body = content.slice(endIndex + 4);

	const frontmatter: Record<string, unknown> = {};
	const lines = yamlBlock.split("\n");
	let currentKey: string | null = null;

	for (const line of lines) {
		const arrayMatch = line.match(/^  - (.+)$/);
		if (arrayMatch && currentKey !== null) {
			const existing = frontmatter[currentKey];
			if (Array.isArray(existing)) {
				existing.push(parseValue(arrayMatch[1]));
			} else {
				frontmatter[currentKey] = [parseValue(arrayMatch[1])];
			}
			continue;
		}

		const kvMatch = line.match(/^([^:]+):\s*(.*)$/);
		if (kvMatch) {
			const key = kvMatch[1].trim();
			const rawValue = kvMatch[2].trim();
			currentKey = key;

			if (rawValue === "") {
				frontmatter[key] = [];
			} else {
				frontmatter[key] = parseValue(rawValue);
			}
		}
	}

	return { frontmatter, body };
}

/** Serialize a frontmatter record and body into a markdown string. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
	const entries = Object.entries(frontmatter).filter(
		([, v]) => v !== null && v !== undefined
	);

	if (entries.length === 0) {
		return body;
	}

	const lines: string[] = ["---"];

	for (const [key, value] of entries) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${serializeValue(item)}`);
			}
		} else {
			lines.push(`${key}: ${serializeValue(value)}`);
		}
	}

	lines.push("---");
	return lines.join("\n") + body;
}
