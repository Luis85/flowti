/**
 * YAML frontmatter parse/serialize for catalog entity markdown files.
 * Pure functions — no I/O.
 */

export interface FrontmatterResult {
	readonly fields: Record<string, string>;
	readonly body: string;
}

/** Parse YAML frontmatter from a markdown string. */
export function parseFrontmatter(md: string): FrontmatterResult {
	const normalized = md.replace(/\r\n/g, "\n");
	const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	if (!match) return { fields: {}, body: normalized.trim() };

	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colon = line.indexOf(":");
		if (colon < 1) continue;
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		fields[key] = value;
	}

	const body = normalized.slice(match[0].length).trim();
	return { fields, body };
}

/** Serialize fields and body into a markdown string with YAML frontmatter. */
export function serializeFrontmatter(fields: Record<string, string | undefined>, body: string): string {
	const lines = Object.entries(fields)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}: ${v}`);
	return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
