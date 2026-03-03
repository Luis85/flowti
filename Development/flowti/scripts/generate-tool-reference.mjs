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
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CATALOG_PATH = path.join(ROOT, "tests", "e2e", "helpers", "toolCatalog.ts");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

/**
 * Extract tool metadata from toolCatalog.ts source.
 *
 * Parses each tool entry block from the TOOL_CATALOG record.
 * Extracts: name, description, tags, useCases.
 */
function extractToolMeta(source) {
	const tools = [];

	// Match each tool entry block: "tool-name": { ... }
	// We'll find each key, then extract its fields.
	const entryRegex = /(?:"([^"]+)"|(\w+)):\s*\{[^}]*?name:\s*"([^"]+)"[^}]*?description:\s*"([^"]+)"[^}]*?tags:\s*\[([^\]]*)\][^}]*?useCases:\s*\[([\s\S]*?)\]\s*,?\s*\}/g;
	let match;
	while ((match = entryRegex.exec(source)) !== null) {
		const name = match[3];
		const description = match[4];
		const tagsRaw = match[5];
		const useCasesRaw = match[6];

		const tags = tagsRaw
			? [...tagsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1])
			: [];
		const useCases = useCasesRaw
			? [...useCasesRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1])
			: [];

		tools.push({ name, description, tags, useCases });
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

	const fm = {
		type: "ToolReference",
		date,
		total_tools: tools.length,
		categories: sortedCategories.length,
		tags: `\n${allTags.map((t) => `  - ${t}`).join("\n")}`,
	};

	const frontmatter = [
		"---",
		...Object.entries(fm).map(([k, v]) =>
			k === "tags" ? `${k}: ${v}` : `${k}: ${yamlEscape(v)}`
		),
		"---",
	].join("\n");

	const bodyLines = [
		"",
		"# Journey Runner Tool Reference",
		"",
		"> [!info] Summary",
		`> Total tools: **${fm.total_tools}** | Categories: **${fm.categories}**`,
		`> Tags: ${allTags.length > 0 ? allTags.map((t) => `\`${t}\``).join(" ") : "_none_"}`,
		"",
		"---",
		"",
	];

	// Quick-reference table
	bodyLines.push("## Quick Reference", "");
	bodyLines.push("| Tool | Description | Tags |");
	bodyLines.push("|------|-------------|------|");
	for (const tool of tools) {
		const tags = tool.tags.length > 0 ? tool.tags.map((t) => `\`${t}\``).join(" ") : "";
		bodyLines.push(`| \`${tool.name}\` | ${tool.description} | ${tags} |`);
	}
	bodyLines.push("", "---", "");

	// Detailed sections by category
	for (const category of sortedCategories) {
		const categoryTools = groups.get(category);
		const label = category.charAt(0).toUpperCase() + category.slice(1);
		bodyLines.push(`## ${label} Tools`, "");

		for (const tool of categoryTools) {
			bodyLines.push(`### \`${tool.name}\``, "");
			bodyLines.push(`> ${tool.description}`, "");

			if (tool.tags.length > 0) {
				bodyLines.push(`**Tags**: ${tool.tags.map((t) => `\`${t}\``).join(" ")}`, "");
			}

			if (tool.useCases.length > 0) {
				bodyLines.push("**When to use**:", "");
				for (const uc of tool.useCases) {
					bodyLines.push(`- ${uc}`);
				}
				bodyLines.push("");
			}
		}

		bodyLines.push("---", "");
	}

	const filename = "Tool Reference.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + bodyLines.join("\n"), "utf-8");

	console.log(`[report] ToolReference written (${tools.length} tools): ${outputPath}`);
}

main();
