/**
 * generate-data-dictionary.mjs
 *
 * Reads entity type metadata from entityTypeRegistry.ts source and generates
 * a Data Dictionary reference document with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-data-dictionary.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.mjs";
import { Document } from "../src/infrastructure/document.mjs";

const REGISTRY_PATH = path.join(ROOT, "src", "domain", "docs", "entityTypeRegistry.ts");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

/**
 * Extract ENTITY_TYPE_REGISTRY entries from TypeScript source.
 * Each entry is a multi-line object in the array.
 */
function extractEntityTypes(source) {
	const entries = [];

	// Find the ENTITY_TYPE_REGISTRY array
	const dataStart = source.indexOf("ENTITY_TYPE_REGISTRY");
	if (dataStart === -1) return entries;

	const dataSection = source.slice(dataStart);

	// Match each top-level object block: { typeName: "...", ... fields: [...] }
	// Use a brace-counting approach since entries contain nested arrays
	let pos = 0;
	while (pos < dataSection.length) {
		const openBrace = dataSection.indexOf("{", pos);
		if (openBrace === -1) break;

		// Find matching close brace
		let depth = 0;
		let end = openBrace;
		for (let i = openBrace; i < dataSection.length; i++) {
			if (dataSection[i] === "{") depth++;
			else if (dataSection[i] === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}

		const block = dataSection.slice(openBrace, end + 1);

		// Only process blocks that look like entity definitions
		if (block.includes("typeName:")) {
			const entry = parseEntityBlock(block);
			if (entry) entries.push(entry);
		}

		pos = end + 1;
	}

	return entries;
}

function parseEntityBlock(block) {
	const get = (key) => {
		const m = block.match(new RegExp(`${key}:\\s*"([^"]*?)"`));
		return m ? m[1] : "";
	};

	const typeName = get("typeName");
	if (!typeName) return null;

	// Extract fields array
	const fields = [];
	const fieldsMatch = block.match(/fields:\s*\[([\s\S]*)\]/);
	if (fieldsMatch) {
		const fieldsBlock = fieldsMatch[1];
		// Match each field object
		const fieldRegex = /\{\s*name:\s*"([^"]*)"[^}]*type:\s*"([^"]*)"[^}]*required:\s*(true|false)[^}]*description:\s*"([^"]*)"[^}]*\}/g;
		let fm;
		while ((fm = fieldRegex.exec(fieldsBlock)) !== null) {
			fields.push({
				name: fm[1],
				type: fm[2],
				required: fm[3] === "true",
				description: fm[4],
			});
		}
	}

	return {
		typeName,
		group: get("group"),
		tab: get("tab"),
		folder: get("folder"),
		nameField: get("nameField"),
		filePattern: get("filePattern"),
		description: get("description"),
		fields,
	};
}

const GROUP_LABELS = {
	catalog: "Event Catalog",
	"data-exchange": "Data Exchange",
	special: "Special",
};

function groupLabel(group) {
	return GROUP_LABELS[group] || group.charAt(0).toUpperCase() + group.slice(1);
}

function main() {
	if (!fs.existsSync(REGISTRY_PATH)) {
		console.log("[report] entityTypeRegistry.ts not found — skipping data dictionary generation.");
		return;
	}

	const source = fs.readFileSync(REGISTRY_PATH, "utf-8");
	const entities = extractEntityTypes(source);

	if (entities.length === 0) {
		console.log("[report] No entity types extracted from registry — skipping.");
		return;
	}

	const now = new Date();
	const date = now.toISOString();

	// Group by group
	const groups = new Map();
	for (const entity of entities) {
		const existing = groups.get(entity.group) ?? [];
		existing.push(entity);
		groups.set(entity.group, existing);
	}

	const totalFields = entities.reduce((sum, e) => sum + e.fields.length, 0);

	const fm = {
		type: "DataDictionary",
		date,
		total_types: entities.length,
		groups: groups.size,
		total_fields: totalFields,
	};

	const doc = Document.create("Data Dictionary")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Data Dictionary")
		.addBlank()
		.callout("info", "Summary", [
			`Total types: ${fm.total_types} | Groups: ${fm.groups} | Total fields: ${fm.total_fields}`,
		])
		.addBlank()
		.heading(2, "Group Summary")
		.addBlank()
		.table(
			["Group", "Types"],
			[...groups].map(([group, typesList]) => [groupLabel(group), String(typesList.length)]),
		)
		.addBlank();

	// Type overview table
	doc.heading(2, "Type Overview").addBlank();
	doc.table(
		["Type", "Group", "Tab", "Folder", "Fields", "Description"],
		entities.map((e) => [e.typeName, groupLabel(e.group), e.tab, `\`${e.folder}\``, String(e.fields.length), e.description]),
	);
	doc.addBlank();

	// Detailed sections per group
	for (const [group, typesList] of groups) {
		doc.heading(2, `${groupLabel(group)} Types`).addBlank();

		for (const entity of typesList) {
			doc.heading(3, entity.typeName).addBlank();
			doc.quote(entity.description).addBlank();
			doc.list([
				`**Tab**: ${entity.tab}`,
				`**Folder**: \`${entity.folder}\``,
				`**Name field**: \`${entity.nameField}\``,
				`**File pattern**: \`${entity.filePattern}\``,
			]);
			doc.addBlank();

			doc.table(
				["Field", "Type", "Required", "Description"],
				entity.fields.map((f) => [`\`${f.name}\``, f.type, f.required ? "Yes" : "No", f.description]),
			);
			doc.addBlank();
		}
	}

	const filename = "Data Dictionary.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] DataDictionary written (${entities.length} types, ${totalFields} fields): ${outputPath}`);
}

main();
