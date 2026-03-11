/**
 * generate-tool-reference.ts — CLI project tool reference generator.
 *
 * Reads tool metadata from TOOL_CATALOG in toolCatalog.ts and generates
 * a Journey Runner Tool Reference vault note with queryable YAML frontmatter.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { clock } from "../../../infrastructure/clock.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import {
	extractBlock,
	extractBracketBlock,
	extractStringField,
	extractStringArrayField,
	tsObjectToJson,
} from "../generators/tool-reference.js";
import type { ToolParam, ToolExample, ToolMeta } from "../generators/tool-reference.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Extraction ───────────────────────────────────────────────────────

function extractExamples(block: string): ToolExample[] {
	const regex = /examples:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent: string | null = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const examples: ToolExample[] = [];
	const objRegex = /\{/g;
	let objMatch: RegExpExecArray | null;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock: string | null = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const title: string | null = extractStringField(objBlock, "title");
		if (!title) continue;

		const actionMatch = /action:\s*\{/.exec(objBlock);
		if (!actionMatch) continue;

		const actionBlock: string | null = extractBlock(objBlock, actionMatch.index + actionMatch[0].length - 1);
		if (!actionBlock) continue;

		const actionJson: string = tsObjectToJson(actionBlock);
		try {
			const action: Record<string, unknown> = JSON.parse(actionJson);
			examples.push({ title, action });
		} catch {
			// Skip unparseable examples
		}

		objRegex.lastIndex = objMatch.index + objBlock.length;
	}

	return examples;
}

function parseParamBlock(objBlock: string): ToolParam | null {
	const name = extractStringField(objBlock, "name");
	if (!name) return null;

	const type = extractStringField(objBlock, "type") ?? "string";
	const requiredMatch = /required:\s*(true|false)/.exec(objBlock);
	const required = requiredMatch ? requiredMatch[1] === "true" : false;
	const description = extractStringField(objBlock, "description") ?? "";
	const values = extractStringArrayField(objBlock, "values");

	return { name, type, required, description, values: values.length > 0 ? values : undefined };
}

function extractParams(block: string): ToolParam[] {
	const regex = /params:\s*\[/s;
	const m = regex.exec(block);
	if (!m) return [];

	const arrContent = extractBracketBlock(block, m.index + m[0].length - 1);
	if (!arrContent) return [];

	const params: ToolParam[] = [];
	const objRegex = /\{/g;
	let objMatch: RegExpExecArray | null;
	while ((objMatch = objRegex.exec(arrContent)) !== null) {
		const objBlock = extractBlock(arrContent, objMatch.index);
		if (!objBlock) continue;

		const param = parseParamBlock(objBlock);
		if (param) params.push(param);

		objRegex.lastIndex = objMatch.index + (objBlock ? objBlock.length : 1);
	}

	return params;
}

function extractToolMeta(source: string): ToolMeta[] {
	const tools: ToolMeta[] = [];

	const catalogIdx: number = source.indexOf("TOOL_CATALOG");
	if (catalogIdx === -1) return tools;

	const entryKeyRegex = /(?:"([^"]+)"|(\w+)):\s*\{/g;
	entryKeyRegex.lastIndex = catalogIdx;

	let match: RegExpExecArray | null;
	while ((match = entryKeyRegex.exec(source)) !== null) {
		const blockStart: number = match.index + match[0].length - 1;
		const block: string | null = extractBlock(source, blockStart);
		if (!block) continue;

		const name: string | null = extractStringField(block, "name");
		if (!name) continue;

		const description: string = extractStringField(block, "description") ?? "";
		const tags: string[] = extractStringArrayField(block, "tags");
		const useCases: string[] = extractStringArrayField(block, "useCases");
		const params: ToolParam[] = extractParams(block);
		const examples: ToolExample[] = extractExamples(block);

		tools.push({ name, description, tags, useCases, params, examples });

		entryKeyRegex.lastIndex = blockStart + block.length;
	}

	return tools;
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupToolsByTag(tools: ToolMeta[]): { groups: Map<string, ToolMeta[]>; sortedCategories: string[] } {
	const groups: Map<string, ToolMeta[]> = new Map();
	for (const tool of tools) {
		const category = tool.tags.length > 0 ? tool.tags[0] : "general";
		const existing = groups.get(category) ?? [];
		existing.push(tool);
		groups.set(category, existing);
	}
	for (const [, list] of groups) {
		list.sort((a, b) => a.name.localeCompare(b.name));
	}
	const sortedCategories = Array.from(groups.keys()).sort((a, b) => {
		if (a === "general") return -1;
		if (b === "general") return 1;
		return a.localeCompare(b);
	});
	return { groups, sortedCategories };
}

function renderToolDetail(doc: Document, tool: ToolMeta): void {
	doc.heading(3, `\`${tool.name}\``).addBlank();
	doc.quote(tool.description).addBlank();

	if (tool.tags.length > 0) doc.text(`**Tags**: ${tool.tags.map((t) => `\`${t}\``).join(" ")}`).addBlank();
	if (tool.useCases.length > 0) { doc.text("**When to use**:").addBlank(); doc.list(tool.useCases).addBlank(); }

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
	} else {
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

// ── Generator ────────────────────────────────────────────────────────

export function generateToolReference(projectPath: string, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath);
	const catalogPath = paths.join(PLUGIN_ROOT, "tests", "e2e", "helpers", "toolCatalog.ts");

	if (!disk.existsSync(catalogPath)) {
		log("[cli-report] Tool catalog source not found — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "Tool catalog source not found" };
	}

	const tools = extractToolMeta(disk.readFileSync(catalogPath, "utf-8"));
	if (tools.length === 0) {
		log("[cli-report] No tools extracted from catalog — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "No tools extracted from catalog" };
	}

	const allTags = [...new Set(tools.flatMap((t) => t.tags))].sort();
	const { groups, sortedCategories } = groupToolsByTag(tools);

	const doc = Document.create("Journey Runner Tool Reference")
		.mergeFrontmatter({
			type: "ToolReference",
			date: clock.iso(),
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
		.callout("tip", "Common field", ["All tools accept an optional `description` field (string) for human-readable context in reports."])
		.addBlank()
		.addSeparator()
		.addBlank();

	doc.heading(2, "Quick Reference").addBlank();
	doc.table(["Tool", "Description", "Tags"], tools.map((t) => [`\`${t.name}\``, t.description, t.tags.map((tag) => `\`${tag}\``).join(" ")]));
	doc.addBlank().addSeparator().addBlank();

	for (const category of sortedCategories) {
		const label = category.charAt(0).toUpperCase() + category.slice(1);
		doc.heading(2, `${label} Tools`).addBlank();
		for (const tool of groups.get(category)!) renderToolDetail(doc, tool);
	}

	const outputPath = svc.saveReference(doc, "Tool Reference.md");

	log(`[cli-report] Tool Reference (${tools.length} tools)`);
	log(`  Categories: ${sortedCategories.length}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { total_tools: tools.length, categories: sortedCategories.length },
	};
}
