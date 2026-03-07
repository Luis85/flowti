/**
 * generate-data-dictionary.ts
 *
 * Reads entity type metadata from entityTypeRegistry.ts source and generates
 * a Data Dictionary reference document with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-data-dictionary.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.js";
import { Document } from "../src/infrastructure/document.js";

interface EntityField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

interface EntityType {
	typeName: string;
	group: string;
	tab: string;
	folder: string;
	nameField: string;
	filePattern: string;
	description: string;
	fields: EntityField[];
}

const REGISTRY_PATH: string = path.join(ROOT, "src", "domain", "docs", "entityTypeRegistry.ts");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reference");

/**
 * Extract ENTITY_TYPE_REGISTRY entries from TypeScript source.
 * Each entry is a multi-line object in the array.
 */
function extractEntityTypes(source: string): EntityType[] {
	const entries: EntityType[] = [];

	// Find the ENTITY_TYPE_REGISTRY array
	const dataStart: number = source.indexOf("ENTITY_TYPE_REGISTRY");
	if (dataStart === -1) return entries;

	const dataSection: string = source.slice(dataStart);

	// Match each top-level object block: { typeName: "...", ... fields: [...] }
	// Use a brace-counting approach since entries contain nested arrays
	let pos: number = 0;
	while (pos < dataSection.length) {
		const openBrace: number = dataSection.indexOf("{", pos);
		if (openBrace === -1) break;

		// Find matching close brace
		let depth: number = 0;
		let end: number = openBrace;
		for (let i: number = openBrace; i < dataSection.length; i++) {
			if (dataSection[i] === "{") depth++;
			else if (dataSection[i] === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}

		const block: string = dataSection.slice(openBrace, end + 1);

		// Only process blocks that look like entity definitions
		if (block.includes("typeName:")) {
			const entry: EntityType | null = parseEntityBlock(block);
			if (entry) entries.push(entry);
		}

		pos = end + 1;
	}

	return entries;
}

function parseEntityBlock(block: string): EntityType | null {
	const get = (key: string): string => {
		const m: RegExpMatchArray | null = block.match(new RegExp(`${key}:\\s*"([^"]*?)"`));
		return m ? m[1] : "";
	};

	const typeName: string = get("typeName");
	if (!typeName) return null;

	// Extract fields array
	const fields: EntityField[] = [];
	const fieldsMatch: RegExpMatchArray | null = block.match(/fields:\s*\[([\s\S]*)\]/);
	if (fieldsMatch) {
		const fieldsBlock: string = fieldsMatch[1];
		// Match each field object
		const fieldRegex = /\{\s*name:\s*"([^"]*)"[^}]*type:\s*"([^"]*)"[^}]*required:\s*(true|false)[^}]*description:\s*"([^"]*)"[^}]*\}/g;
		let fm: RegExpExecArray | null;
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

const GROUP_LABELS: Record<string, string> = {
	catalog: "Event Catalog",
	"data-exchange": "Data Exchange",
	special: "Special",
};

function groupLabel(group: string): string {
	return GROUP_LABELS[group] || group.charAt(0).toUpperCase() + group.slice(1);
}

function main(): void {
	if (!fs.existsSync(REGISTRY_PATH)) {
		console.log("[report] entityTypeRegistry.ts not found — skipping data dictionary generation.");
		return;
	}

	const source: string = fs.readFileSync(REGISTRY_PATH, "utf-8");
	const entities: EntityType[] = extractEntityTypes(source);

	if (entities.length === 0) {
		console.log("[report] No entity types extracted from registry — skipping.");
		return;
	}

	const now: Date = new Date();
	const date: string = now.toISOString();

	// Group by group
	const groups: Map<string, EntityType[]> = new Map();
	for (const entity of entities) {
		const existing: EntityType[] = groups.get(entity.group) ?? [];
		existing.push(entity);
		groups.set(entity.group, existing);
	}

	const totalFields: number = entities.reduce((sum: number, e: EntityType) => sum + e.fields.length, 0);

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
			[...groups].map(([group, typesList]: [string, EntityType[]]) => [groupLabel(group), String(typesList.length)]),
		)
		.addBlank();

	// Type overview table
	doc.heading(2, "Type Overview").addBlank();
	doc.table(
		["Type", "Group", "Tab", "Folder", "Fields", "Description"],
		entities.map((e: EntityType) => [e.typeName, groupLabel(e.group), e.tab, `\`${e.folder}\``, String(e.fields.length), e.description]),
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
				entity.fields.map((f: EntityField) => [`\`${f.name}\``, f.type, f.required ? "Yes" : "No", f.description]),
			);
			doc.addBlank();
		}
	}

	const filename: string = "Data Dictionary.md";
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] DataDictionary written (${entities.length} types, ${totalFields} fields): ${outputPath}`);
}

main();
