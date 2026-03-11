/**
 * generate-data-dictionary.ts — CLI project data dictionary generator.
 *
 * Reads entity type metadata from entityTypeRegistry.ts source and generates
 * a Data Dictionary reference document with queryable YAML frontmatter.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { extractEntityTypes, groupLabel } from "../generators/data-dictionary.js";
import type { EntityType, EntityField } from "../generators/data-dictionary.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateDataDictionary(projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const registryPath = deps.paths.join(PLUGIN_ROOT, "src", "domain", "docs", "entityTypeRegistry.ts");

	if (!deps.disk.existsSync(registryPath)) {
		log("[cli-report] entityTypeRegistry.ts not found — skipping data dictionary generation.");
		return { success: false, outputPath: "", metrics: {}, error: "entityTypeRegistry.ts not found" };
	}

	const source: string = deps.disk.readFileSync(registryPath, "utf-8");
	const entities: EntityType[] = extractEntityTypes(source);

	if (entities.length === 0) {
		log("[cli-report] No entity types extracted from registry — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "No entity types extracted from registry" };
	}

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
		date: deps.clock.iso(),
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

	const outputPath = svc.saveReference(doc, "Data Dictionary.md");

	log(`[cli-report] Data Dictionary (${entities.length} types, ${totalFields} fields)`);
	log(`  Groups: ${groups.size}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { total_types: entities.length, groups: groups.size, total_fields: totalFields },
	};
}
