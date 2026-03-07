/**
 * generate-tool-reference.ts
 *
 * Reads tool metadata from TOOL_CATALOG in toolCatalog.ts and generates
 * a Journey Runner Tool Reference vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-tool-reference.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.js";
import { Document } from "../src/infrastructure/document.js";

interface ToolParam {
	name: string;
	type: string;
	required: boolean;
	description: string;
	values?: string[];
}

interface ToolExample {
	title: string;
	action: Record<string, unknown>;
}

interface ToolMeta {
	name: string;
	description: string;
	tags: string[];
	useCases: string[];
	params: ToolParam[];
	examples: ToolExample[];
}

const CATALOG_PATH: string = path.join(ROOT, "tests", "e2e", "helpers", "toolCatalog.ts");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reference");

/**
 * Extract a balanced brace block starting at `pos` (which must be `{`).
 * Returns the content between `{` and `}` (inclusive), or null.
 */
function extractBlock(source: string, pos: number): string | null {
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
function extractBracketBlock(source: string, pos: number): string | null {
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
function extractStringField(block: string, fieldName: string): string | null {
	const regex = new RegExp(`${fieldName}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
	const m = block.match(regex);
	if (!m) return null;
	// Unescape \" to " in the extracted value
	return m[1].replace(/\\"/g, '"');
}

/**
 * Extract a string array field: `fieldName: ["a", "b", ...]`.
 */
function extractStringArrayField(block: string, fieldName: string): string[] {
	const regex = new RegExp(`${fieldName}:\\s*\\[`, "s");
	const m = regex.exec(block);
	if (!m) return [];
	const arrContent: string | null = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];
	return [...arrContent.matchAll(/"([^"]+)"/g)].map((x: RegExpExecArray) => x[1]);
}

/**
 * Extract examples array: `examples: [{ title: "...", action: { ... } }, ...]`.
 * Returns array of { title, action } where action is a plain object.
 */
function extractExamples(block: string): ToolExample[] {
	const regex = /examples:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent: string | null = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const examples: ToolExample[] = [];
	// Find each example object `{ title: "...", action: { ... } }`
	const objRegex = /\{/g;
	let objMatch: RegExpExecArray | null;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock: string | null = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const title: string | null = extractStringField(objBlock, "title");
		if (!title) continue; // not an example object

		// Extract the action object
		const actionMatch = /action:\s*\{/.exec(objBlock);
		if (!actionMatch) continue;

		const actionBlock: string | null = extractBlock(objBlock, actionMatch.index + actionMatch[0].length - 1);
		if (!actionBlock) continue;

		// Convert TS action block to JSON-parseable format
		const actionJson: string = tsObjectToJson(actionBlock);
		try {
			const action: Record<string, unknown> = JSON.parse(actionJson);
			examples.push({ title, action });
		} catch {
			// Skip unparseable examples
		}

		// Advance past this object
		objRegex.lastIndex = objMatch.index + objBlock.length;
	}

	return examples;
}

/**
 * Extract params array: `params: [{ name, type, required, description, values? }, ...]`.
 * Returns array of { name, type, required, description, values? }.
 */
function extractParams(block: string): ToolParam[] {
	const regex = /params:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent: string | null = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const params: ToolParam[] = [];
	const objRegex = /\{/g;
	let objMatch: RegExpExecArray | null;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock: string | null = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const name: string | null = extractStringField(objBlock, "name");
		if (!name) {
			objRegex.lastIndex = objMatch.index + (objBlock ? objBlock.length : 1);
			continue;
		}

		const type: string = extractStringField(objBlock, "type") ?? "string";
		const requiredMatch = /required:\s*(true|false)/.exec(objBlock);
		const required: boolean = requiredMatch ? requiredMatch[1] === "true" : false;
		const description: string = extractStringField(objBlock, "description") ?? "";
		const values: string[] = extractStringArrayField(objBlock, "values");

		params.push({ name, type, required, description, values: values.length > 0 ? values : undefined });

		objRegex.lastIndex = objMatch.index + objBlock.length;
	}

	return params;
}

/**
 * Convert a TypeScript object literal to valid JSON.
 * Handles: unquoted keys, trailing commas.
 * Note: TS source uses double-quoted strings; single quotes inside string
 * values (e.g. CSS selectors) are valid JSON and must NOT be replaced.
 */
function tsObjectToJson(tsBlock: string): string {
	let json: string = tsBlock;
	// Quote unquoted keys: `key:` → `"key":`
	json = json.replace(/(\{|,)\s*(\w+)\s*:/g, '$1 "$2":');
	// Remove trailing commas before } or ]
	json = json.replace(/,\s*([\]}])/g, "$1");
	return json;
}

/**
 * Extract tool metadata from toolCatalog.ts source.
 *
 * Uses balanced-brace parsing to handle nested structures (examples).
 */
function extractToolMeta(source: string): ToolMeta[] {
	const tools: ToolMeta[] = [];

	// Find TOOL_CATALOG
	const catalogIdx: number = source.indexOf("TOOL_CATALOG");
	if (catalogIdx === -1) return tools;

	// Find each tool entry: either `"tool-name": {` or `toolName: {`
	const entryKeyRegex = /(?:"([^"]+)"|(\w+)):\s*\{/g;
	entryKeyRegex.lastIndex = catalogIdx;

	let match: RegExpExecArray | null;
	while ((match = entryKeyRegex.exec(source)) !== null) {
		const blockStart: number = match.index + match[0].length - 1;
		const block: string | null = extractBlock(source, blockStart);
		if (!block) continue;

		const name: string | null = extractStringField(block, "name");
		if (!name) continue; // not a tool entry

		const description: string = extractStringField(block, "description") ?? "";
		const tags: string[] = extractStringArrayField(block, "tags");
		const useCases: string[] = extractStringArrayField(block, "useCases");
		const params: ToolParam[] = extractParams(block);
		const examples: ToolExample[] = extractExamples(block);

		tools.push({ name, description, tags, useCases, params, examples });

		// Advance past this block to avoid re-matching inner braces
		entryKeyRegex.lastIndex = blockStart + block.length;
	}

	return tools;
}

function main(): void {
	if (!fs.existsSync(CATALOG_PATH)) {
		console.log("[report] Tool catalog source not found — skipping.");
		return;
	}

	const source: string = fs.readFileSync(CATALOG_PATH, "utf-8");
	const tools: ToolMeta[] = extractToolMeta(source);

	if (tools.length === 0) {
		console.log("[report] No tools extracted from catalog — skipping.");
		return;
	}

	const now = new Date();
	const date: string = now.toISOString();

	// Collect unique tags
	const allTags: string[] = [...new Set(tools.flatMap((t: ToolMeta) => t.tags))].sort();

	// Group tools by tag category (tools with no tags go into "general")
	const groups: Map<string, ToolMeta[]> = new Map();
	for (const tool of tools) {
		const category: string = tool.tags.length > 0 ? tool.tags[0] : "general";
		const existing: ToolMeta[] = groups.get(category) ?? [];
		existing.push(tool);
		groups.set(category, existing);
	}
	for (const [, list] of groups) {
		list.sort((a: ToolMeta, b: ToolMeta) => a.name.localeCompare(b.name));
	}
	// Sort categories: "general" first, then alphabetical
	const sortedCategories: string[] = Array.from(groups.keys()).sort((a: string, b: string) => {
		if (a === "general") return -1;
		if (b === "general") return 1;
		return a.localeCompare(b);
	});

	const doc = Document.create("Journey Runner Tool Reference")
		.mergeFrontmatter({
			type: "ToolReference",
			date,
			total_tools: tools.length,
			categories: sortedCategories.length,
		})
		.setTags(allTags)
		.addBlank()
		.heading(1, "Journey Runner Tool Reference")
		.addBlank()
		.callout("info", "Summary", [
			`Total tools: **${tools.length}** | Categories: **${sortedCategories.length}**`,
			`Tags: ${allTags.length > 0 ? allTags.map((t: string) => `\`${t}\``).join(" ") : "_none_"}`,
		])
		.addBlank()
		.callout("tip", "Common field", [
			"All tools accept an optional `description` field (string) for human-readable context in reports.",
		])
		.addBlank()
		.addSeparator()
		.addBlank();

	// Quick-reference table
	doc.heading(2, "Quick Reference").addBlank();
	doc.table(
		["Tool", "Description", "Tags"],
		tools.map((t: ToolMeta) => [
			`\`${t.name}\``,
			t.description,
			t.tags.length > 0 ? t.tags.map((tag: string) => `\`${tag}\``).join(" ") : "",
		]),
	);
	doc.addBlank().addSeparator().addBlank();

	// Detailed sections by category
	for (const category of sortedCategories) {
		const categoryTools: ToolMeta[] = groups.get(category)!;
		const label: string = category.charAt(0).toUpperCase() + category.slice(1);
		doc.heading(2, `${label} Tools`).addBlank();

		for (const tool of categoryTools) {
			doc.heading(3, `\`${tool.name}\``).addBlank();
			doc.quote(tool.description).addBlank();

			if (tool.tags.length > 0) {
				doc.text(`**Tags**: ${tool.tags.map((t: string) => `\`${t}\``).join(" ")}`).addBlank();
			}

			if (tool.useCases.length > 0) {
				doc.text("**When to use**:").addBlank();
				doc.list(tool.useCases).addBlank();
			}

			if (tool.params.length > 0) {
				doc.text("**Parameters**:").addBlank();
				doc.table(
					["Param", "Type", "Required", "Description"],
					tool.params.map((p: ToolParam) => {
						let desc: string = p.description;
						if (p.values) desc += ` — \`${p.values.join("` \\| `")}\``;
						return [`\`${p.name}\``, `\`${p.type}\``, p.required ? "Yes" : "No", desc];
					}),
				);
				doc.addBlank();
			}

			if (tool.params.length === 0) {
				doc.text("*No parameters — use as-is.*").addBlank();
			}

			if (tool.examples.length > 0) {
				doc.text("**Examples**:").addBlank();
				for (const ex of tool.examples) {
					doc.text(`*${ex.title}*`);
					doc.codeBlock("json", JSON.stringify(ex.action, null, 2));
					doc.addBlank();
				}
			}

			doc.addSeparator().addBlank();
		}
	}

	const filename: string = "Tool Reference.md";
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] ToolReference written (${tools.length} tools): ${outputPath}`);
}

main();
