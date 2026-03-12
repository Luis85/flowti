/**
 * generate-entity-reference.ts
 *
 * Generates an Entity Reference document — the entity dictionary of the
 * Flowti CLI ecosystem. Describes each business entity, its purpose,
 * where it lives in the codebase, and how it relates to other entities.
 *
 * Usage: npm run reports (part of reports pipeline)
 */

import { Document } from "../../../infrastructure/document.js";

import { ReportService } from "../cli/report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import { ENTITY_REGISTRY } from "./entity-registry.js";
export type { EntityDef } from "./entity-registry.js";
export { ENTITY_REGISTRY } from "./entity-registry.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateEntityReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const entities = ENTITY_REGISTRY;

	const doc = Document.create("Entity Reference")
		.mergeFrontmatter({
			type: "EntityReference",
			date: deps.clock.iso(),
			total_entities: entities.length,
			tags: ["reference", "entities", "architecture"],
		})
		.addBlank()
		.heading(1, "Entity Reference")
		.addBlank()
		.text("The entity dictionary of the Flowti CLI ecosystem. Each entry describes what the entity is, why it exists, where it lives in the codebase, and how it relates to other entities.")
		.addBlank();

	// Summary table
	doc.heading(2, "Summary")
		.addBlank()
		.table(
			["Entity", "Commands", "Related To"],
			entities.map((e) => [
				`[[#${e.name}\\|${e.name}]]`,
				e.commands.length > 0 ? e.commands.map((c) => `\`${c}\``).join(", ") : "—",
				e.relatedEntities.join(", ") || "—",
			]),
		)
		.addBlank();

	// Detail sections
	for (const entity of entities) {
		doc.heading(2, entity.name)
			.addBlank()
			.text(entity.description)
			.addBlank()
			.heading(3, "Purpose")
			.addBlank()
			.text(entity.purpose)
			.addBlank();

		doc.heading(3, "Where")
			.addBlank()
			.list(entity.locations)
			.addBlank();

		if (entity.configKey) {
			doc.heading(3, "Configuration")
				.addBlank()
				.text(`Config keys: \`${entity.configKey}\``)
				.addBlank();
		}

		if (entity.commands.length > 0) {
			doc.heading(3, "Commands")
				.addBlank()
				.list(entity.commands.map((c) => `\`flowti ${c}\``))
				.addBlank();
		}

		if (entity.artifacts.length > 0) {
			doc.heading(3, "Artifacts")
				.addBlank()
				.list(entity.artifacts.map((a) => `\`${a}\``))
				.addBlank();
		}

		if (entity.relatedEntities.length > 0) {
			doc.heading(3, "Related Entities")
				.addBlank()
				.list(entity.relatedEntities.map((r) => `[[#${r}|${r}]]`))
				.addBlank();
		}

		doc.addSeparator().addBlank();
	}

	// Save — reference document (stable only, no timestamps)
	const outputPath = svc.saveReference(doc, "Entity Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { total_entities: entities.length },
	};
}
