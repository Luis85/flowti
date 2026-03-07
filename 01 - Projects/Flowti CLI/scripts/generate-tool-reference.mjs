/**
 * generate-tool-reference.mjs
 *
 * Reads tool metadata from TOOL_CATALOG in toolCatalog.ts and generates
 * a Journey Runner Tool Reference vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-tool-reference.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.mjs";
import { Document } from "../src/infrastructure/document.mjs";

const CATALOG_PATH = path.join(ROOT, "tests", "e2e", "helpers", "toolCatalog.ts");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

/**
 * Extract a balanced brace block starting at `pos` (which must be `{`).
 * Returns the content between `{` and `}` (inclusive), or null.
 */
function extractBlock(source, pos) {
	if (source[pos] !== "{") return null;
	let depth = 0;
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
function extractBracketBlock(source, pos) {
	if (source[pos] !== "[") return null;
	let depth = 0;
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
function extractStringField(block, fieldName) {
	const regex = new RegExp(`${fieldName}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
	const m = block.match(regex);
	if (!m) return null;
	// Unescape \" to " in the extracted value
	return m[1].replace(/\\"/g, '"');
}

/**
 * Extract a string array field: `fieldName: ["a", "b", ...]`.
 */
function extractStringArrayField(block, fieldName) {
	const regex = new RegExp(`${fieldName}:\\s*\\[`, "s");
	const m = regex.exec(block);
	if (!m) return [];
	const arrContent = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];
	return [...arrContent.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/**
 * Extract examples array: `examples: [{ title: "...", action: { ... } }, ...]`.
 * Returns array of { title, action } where action is a plain object.
 */
function extractExamples(block) {
	const regex = /examples:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const examples = [];
	// Find each example object `{ title: "...", action: { ... } }`
	const objRegex = /\{/g;
	let objMatch;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const title = extractStringField(objBlock, "title");
		if (!title) continue; // not an example object

		// Extract the action object
		const actionMatch = /action:\s*\{/.exec(objBlock);
		if (!actionMatch) continue;

		const actionBlock = extractBlock(objBlock, actionMatch.index + actionMatch[0].length - 1);
		if (!actionBlock) continue;

		// Convert TS action block to JSON-parseable format
		const actionJson = tsObjectToJson(actionBlock);
		try {
			const action = JSON.parse(actionJson);
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
function extractParams(block) {
	const regex = /params:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const params = [];
	const objRegex = /\{/g;
	let objMatch;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const name = extractStringField(objBlock, "name");
		if (!name) {
			objRegex.lastIndex = objMatch.index + (objBlock ? objBlock.length : 1);
			continue;
		}

		const type = extractStringField(objBlock, "type") ?? "string";
		const requiredMatch = /required:\s*(true|false)/.exec(objBlock);
		const required = requiredMatch ? requiredMatch[1] === "true" : false;
		const description = extractStringField(objBlock, "description") ?? "";
		const values = extractStringArrayField(objBlock, "values");

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
function tsObjectToJson(tsBlock) {
	let json = tsBlock;
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
function extractToolMeta(source) {
	const tools = [];

	// Find TOOL_CATALOG
	const catalogIdx = source.indexOf("TOOL_CATALOG");
	if (catalogIdx === -1) return tools;

	// Find each tool entry: either `"tool-name": {` or `toolName: {`
	const entryKeyRegex = /(?:"([^"]+)"|(\w+)):\s*\{/g;
	entryKeyRegex.lastIndex = catalogIdx;

	let match;
	while ((match = entryKeyRegex.exec(source)) !== null) {
		const blockStart = match.index + match[0].length - 1;
		const block = extractBlock(source, blockStart);
		if (!block) continue;

		const name = extractStringField(block, "name");
		if (!name) continue; // not a tool entry

		const description = extractStringField(block, "description") ?? "";
		const tags = extractStringArrayField(block, "tags");
		const useCases = extractStringArrayField(block, "useCases");
		const params = extractParams(block);
		const examples = extractExamples(block);

		tools.push({ name, description, tags, useCases, params, examples });

		// Advance past this block to avoid re-matching inner braces
		entryKeyRegex.lastIndex = blockStart + block.length;
	}

	return tools;
}

function main() {
	if (!fs.existsSync(CATALOG_PATH)) {
		console.log("[report] Tool catalog source not found — skipping.");
		return;
	}

	const source = fs.readFileSync(CATALOG_PATH, "utf-8");
	const tools = extractToolMeta(source);

	if (tools.length === 0) {
		console.log("[report] No tools extracted from catalog — skipping.");
		return;
	}

	const now = new Date();
	const date = now.toISOString();

	// Collect unique tags
	const allTags = [...new Set(tools.flatMap((t) => t.tags))].sort();

	// Group tools by tag category (tools with no tags go into "general")
	const groups = new Map();
	for (const tool of tools) {
		const category = tool.tags.length > 0 ? tool.tags[0] : "general";
		const existing = groups.get(category) ?? [];
		existing.push(tool);
		groups.set(category, existing);
	}
	for (const [, list] of groups) {
		list.sort((a, b) => a.name.localeCompare(b.name));
	}
	// Sort categories: "general" first, then alphabetical
	const sortedCategories = Array.from(groups.keys()).sort((a, b) => {
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
			`Tags: ${allTags.length > 0 ? allTags.map((t) => `\`${t}\``).join(" ") : "_none_"}`,
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
		tools.map((t) => [
			`\`${t.name}\``,
			t.description,
			t.tags.length > 0 ? t.tags.map((tag) => `\`${tag}\``).join(" ") : "",
		]),
	);
	doc.addBlank().addSeparator().addBlank();

	// Detailed sections by category
	for (const category of sortedCategories) {
		const categoryTools = groups.get(category);
		const label = category.charAt(0).toUpperCase() + category.slice(1);
		doc.heading(2, `${label} Tools`).addBlank();

		for (const tool of categoryTools) {
			doc.heading(3, `\`${tool.name}\``).addBlank();
			doc.quote(tool.description).addBlank();

			if (tool.tags.length > 0) {
				doc.text(`**Tags**: ${tool.tags.map((t) => `\`${t}\``).join(" ")}`).addBlank();
			}

			if (tool.useCases.length > 0) {
				doc.text("**When to use**:").addBlank();
				doc.list(tool.useCases).addBlank();
			}

			if (tool.params.length > 0) {
				doc.text("**Parameters**:").addBlank();
				doc.table(
					["Param", "Type", "Required", "Description"],
					tool.params.map((p) => {
						let desc = p.description;
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

	const filename = "Tool Reference.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] ToolReference written (${tools.length} tools): ${outputPath}`);
}

main();
