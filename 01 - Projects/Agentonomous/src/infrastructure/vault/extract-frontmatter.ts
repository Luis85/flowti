/**
 * Extracts YAML frontmatter from a Markdown string.
 * Only parses flat key-value pairs (one per line).
 * Splits on first `: ` occurrence to handle colons in values.
 */
export function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (match === null || match[1] === undefined || match[1].length === 0) return {};
	const lines = match[1].split('\n');
	const result: Record<string, string> = {};
	for (const line of lines) {
		const colonIndex = line.indexOf(': ');
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 2).trim();
		if (key.length > 0) result[key] = value;
	}
	return result;
}
