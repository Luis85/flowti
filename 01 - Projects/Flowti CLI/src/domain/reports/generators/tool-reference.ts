/**
 * generate-tool-reference.ts
 *
 * Pure helper functions for tool reference generation.
 */

export interface ToolParam {
	name: string;
	type: string;
	required: boolean;
	description: string;
	values?: string[];
}

export interface ToolExample {
	title: string;
	action: Record<string, unknown>;
}

export interface ToolMeta {
	name: string;
	description: string;
	tags: string[];
	useCases: string[];
	params: ToolParam[];
	examples: ToolExample[];
}

/**
 * Extract a balanced brace block starting at `pos` (which must be `{`).
 * Returns the content between `{` and `}` (inclusive), or null.
 */
export function extractBlock(source: string, pos: number): string | null {
	if (source[pos] !== "{") return null;
	let depth: number = 0;
	for (let i = pos; i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		if (depth === 0) return source.slice(pos, i + 1);
	}
	return null;
}

/**
 * Extract a balanced bracket block starting at `pos` (which must be `[`).
 * Returns the content between `[` and `]` (inclusive), or null.
 */
export function extractBracketBlock(source: string, pos: number): string | null {
	if (source[pos] !== "[") return null;
	let depth: number = 0;
	for (let i = pos; i < source.length; i++) {
		if (source[i] === "[") depth++;
		else if (source[i] === "]") depth--;
		if (depth === 0) return source.slice(pos, i + 1);
	}
	return null;
}

/**
 * Extract a string field value: `fieldName: "value"`.
 * Handles escaped quotes inside the string (e.g. `"default: \"dom\""`).
 */
export function extractStringField(block: string, fieldName: string): string | null {
	const regex = new RegExp(`${fieldName}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
	const m = block.match(regex);
	if (!m) return null;
	// Unescape \" to " in the extracted value
	return m[1].replace(/\\"/g, '"');
}

/**
 * Extract a string array field: `fieldName: ["a", "b", ...]`.
 */
export function extractStringArrayField(block: string, fieldName: string): string[] {
	const regex = new RegExp(`${fieldName}:\\s*\\[`, "s");
	const m = regex.exec(block);
	if (!m) return [];
	const arrContent: string | null = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];
	return [...arrContent.matchAll(/"([^"]+)"/g)].map((x: RegExpExecArray) => x[1]);
}

/**
 * Convert a TypeScript object literal to valid JSON.
 * Handles: unquoted keys, trailing commas.
 * Note: TS source uses double-quoted strings; single quotes inside string
 * values (e.g. CSS selectors) are valid JSON and must NOT be replaced.
 */
export function tsObjectToJson(tsBlock: string): string {
	let json: string = tsBlock;
	// Quote unquoted keys: `key:` → `"key":`
	json = json.replace(/(\{|,)\s*(\w+)\s*:/g, '$1 "$2":');
	// Remove trailing commas before } or ]
	json = json.replace(/,\s*([\]}])/g, "$1");
	return json;
}
