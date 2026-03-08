/**
 * generate-data-dictionary.ts
 *
 * Reads entity type metadata from entityTypeRegistry.ts source and generates
 * a Data Dictionary reference document with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-data-dictionary.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";

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

const REGISTRY_PATH: string = paths.join(ROOT, "src", "domain", "docs", "entityTypeRegistry.ts");
const OUTPUT_DIR: string = paths.join(ROOT, "docs", "reference");

function findMatchingBrace(source: string, openPos: number): number {
	let depth = 0;
	for (let i = openPos; i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return openPos;
}

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

		const end: number = findMatchingBrace(dataSection, openBrace);

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
	if (!disk.existsSync(REGISTRY_PATH)) {
		log("[report] entityTypeRegistry.ts not found — skipping data dictionary generation.");
		return;
	}

	const source: string = disk.readFileSync(REGISTRY_PATH, "utf-8");
	const entities: EntityType[] = extractEntityTypes(source);

	if (entities.length === 0) {
		log("[report] No entity types extracted from registry — skipping.");
		return;
	}

	const date: string = clock.iso();

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
	const outputPath: string = paths.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	log(`[report] DataDictionary written (${entities.length} types, ${totalFields} fields): ${outputPath}`);
}

main();
