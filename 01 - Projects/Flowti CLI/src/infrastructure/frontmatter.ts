/**
 * frontmatter.ts — Shared YAML frontmatter parser.
 *
 * Parses YAML frontmatter from markdown strings, handling scalars
 * (booleans, integers, floats, quoted strings) and simple arrays.
 */

export function parseScalar(rawValue: string): unknown {
	if (rawValue === "true") return true;
	if (rawValue === "false") return false;
	if (/^-?\d+$/.test(rawValue)) return parseInt(rawValue, 10);
	if (/^-?\d+\.\d+$/.test(rawValue)) return parseFloat(rawValue);
	return rawValue.replace(/^["']|["']$/g, "");
}

export function parseFrontmatterContent(content: string): Record<string, unknown> | null {
	const match: RegExpMatchArray | null = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
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
