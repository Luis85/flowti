/**
 * frontmatter-utils.ts — Pure functions for frontmatter manipulation.
 *
 * Extracted from fix-frontmatter.ts for testability.
 */

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: string, body: string, fields: Record<string, string> }
 */
export function parseFrontmatter(content: string): { frontmatterRaw: string; body: string; fields: Record<string, string>; fullMatch: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const frontmatterRaw: string = match[1];
	const body: string = content.slice(match[0].length);
	const fields: Record<string, string> = {};

	for (const line of frontmatterRaw.split(/\r?\n/)) {
		const fieldMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
		if (fieldMatch) {
			fields[fieldMatch[1]] = fieldMatch[2].trim();
		}
	}

	return { frontmatterRaw, body, fields, fullMatch: match[0] };
}

/**
 * Insert a field after the opening --- line in frontmatter.
 */
export function insertField(content: string, fieldName: string, fieldValue: string): string {
	return content.replace(/^---\r?\n/, `---\n${fieldName}: ${fieldValue}\n`);
}

/**
 * Replace a field value in frontmatter.
 */
export function replaceField(content: string, fieldName: string, newValue: string): string {
	const regex = new RegExp(`^(${fieldName}:\\s*)(.*)$`, "m");
	return content.replace(regex, `$1${newValue}`);
}

/**
 * Apply a single field rule to the content, returning updated content, whether it changed, and an optional log message.
 */
export function applyFieldRule(
	content: string, filePath: string,
	fields: Record<string, string>,
	rule: { field: string; value: string; action: string },
): { content: string; changed: boolean; message?: string } {
	const { field, value, action } = rule;
	if (action === "add" && !fields[field]) {
		return { content: insertField(content, field, value), changed: true, message: `  ADD ${field}: ${value} → ${filePath}` };
	}
	if (action === "replace" && fields[field] !== value) {
		return { content: replaceField(content, field, value), changed: true, message: `  REPLACE ${field}: ${fields[field]} → ${value} in ${filePath}` };
	}
	return { content, changed: false };
}
