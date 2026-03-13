/**
 * c4-doc.ts — Markdown documentation template for C4 architecture entities.
 *
 * Uses the Document builder for YAML-safe frontmatter and standardized rendering.
 */

import { Document } from "../../../../infrastructure/document.js";
import type { CliDeps } from "../../../../infrastructure/deps.js";
import type { ComponentVariables, ComponentDefinition, ComponentRelationship } from "../component-types.js";
import { buildRelatedFilesSection } from "./related-files.js";

export type TemplateDeps = Pick<CliDeps, "clock">;

const C4_LABELS: Record<string, string> = {
	system: "System",
	container: "Container",
	"c4-component": "Component",
	person: "Person",
};

/** Auto-map C4 kind to Arc42 building block level. */
const C4_TO_ARC42: Record<string, string> = {
	system: "context",
	container: "container",
	"c4-component": "component",
	person: "context",
};

/** Kind-specific markdown sections appended after the description. */
const KIND_SECTIONS: Record<string, [string, string][]> = {
	system: [
		["Boundaries", "<!-- Define what is inside and outside this system. -->"],
		["Containers", "<!-- List the containers that compose this system. -->"],
	],
	container: [
		["Technology", "{{technology}}"],
		["Components", "<!-- List the components within this container. -->"],
	],
	"c4-component": [
		["Responsibilities", "<!-- Describe what this component is responsible for. -->"],
		["Interfaces", "<!-- List the interfaces this component exposes. -->"],
	],
	person: [
		["Role", "<!-- Describe this actor's role and goals. -->"],
		["Interactions", "<!-- List the systems this person interacts with. -->"],
	],
};

function applyOptionalFields(doc: Document, vars: ComponentVariables, def: ComponentDefinition): void {
	if (vars.technology) doc.setFrontmatter("technology", vars.technology);
	if (vars.containedBy) doc.setFrontmatter("containedBy", vars.containedBy);
	if (vars.owner) doc.setFrontmatter("owner", vars.owner);
	for (const prop of def.properties) {
		const val = vars[`prop.${prop.key}`];
		if (val != null && val !== "") doc.setFrontmatter(prop.key, val);
	}
}

function applyFrontmatter(doc: Document, vars: ComponentVariables, def: ComponentDefinition, deps: TemplateDeps): void {
	const meta = def.metadata;
	const c4Label = C4_LABELS[def.kind] ?? def.kind;
	const c4Level = meta.c4Level != null ? String(meta.c4Level) : "";

	doc.setFrontmatter("type", String(meta.type ?? def.kind));
	doc.setFrontmatter("c4", c4Label);
	if (c4Level) doc.setFrontmatter("c4Level", c4Level);
	const arc42 = def.arc42Level ?? C4_TO_ARC42[def.kind];
	if (arc42) doc.setFrontmatter("arc42Level", arc42);
	doc.setFrontmatter("status", "draft");
	doc.setFrontmatter("created", deps.clock.iso().slice(0, 10));
	if (def.role) doc.setFrontmatter("role", def.role);
	if (def.priority) doc.setFrontmatter("priority", def.priority);
	applyOptionalFields(doc, vars, def);
}

export function c4DocTemplate(vars: ComponentVariables, def: ComponentDefinition, deps: TemplateDeps): Document {
	const c4Label = C4_LABELS[def.kind] ?? def.kind;
	const doc = Document.create(vars.name);
	applyFrontmatter(doc, vars, def, deps);

	doc.addBlank()
		.heading(1, vars.name)
		.addBlank()
		.quote(`C4 ${c4Label}`)
		.addBlank();

	if (vars.description) doc.text(vars.description).addBlank();

	const sections = KIND_SECTIONS[def.kind] ?? [];
	for (const [heading, placeholder] of sections) {
		const content = placeholder === "{{technology}}"
			? (vars.technology || "<!-- Describe the technology stack. -->")
			: placeholder;
		doc.heading(2, heading).addBlank().text(content).addBlank();
	}

	appendRelationships(doc, def.relationships);

	if (vars.containedBy) {
		doc.heading(2, "Contained By").addBlank()
			.text(Document.wikilink(vars.containedBy))
			.addBlank();
	}

	appendRequirements(doc, def.requirements);

	buildRelatedFilesSection(doc, vars, def);

	return doc;
}

function appendRelationships(doc: Document, relationships?: ComponentRelationship[]): void {
	doc.heading(2, "Relationships").addBlank();
	if (!relationships || relationships.length === 0) {
		doc.text("<!-- Describe relationships to other components. -->").addBlank();
		return;
	}
	doc.table(
		["Target", "Type", "Technology", "Description"],
		relationships.map((r) => [
			Document.wikilink(r.target),
			r.type,
			r.technology ?? "—",
			r.description ?? "",
		]),
	).addBlank();
}

function appendRequirements(doc: Document, requirements?: string[]): void {
	if (!requirements || requirements.length === 0) return;
	doc.heading(2, "Requirements").addBlank();
	for (const req of requirements) {
		doc.text(`- ${Document.wikilink(req)}`);
	}
	doc.addBlank();
}
