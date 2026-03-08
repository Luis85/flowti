/**
 * component-doc.ts — Markdown documentation template for generic components.
 *
 * Uses the Document builder for YAML-safe frontmatter and standardized rendering.
 */

import { Document } from "../../../../infrastructure/document.js";
import { clock } from "../../../../infrastructure/clock.js";
import type { ComponentVariables, ComponentDefinition, ComponentProperty } from "../component-types.js";

function applyFrontmatter(doc: Document, vars: ComponentVariables, def: ComponentDefinition): void {
	const meta = def.metadata;
	doc.setFrontmatter("type", String(meta.type ?? "component"));
	doc.setFrontmatter("status", String(meta.status ?? "draft"));
	doc.setFrontmatter("created", clock.iso().slice(0, 10));
	if (vars.owner) doc.setFrontmatter("owner", vars.owner);
	for (const prop of def.properties) {
		const val = vars[`prop.${prop.key}`];
		if (val != null && val !== "") doc.setFrontmatter(prop.key, val);
	}
}

function appendPropertiesTable(doc: Document, properties: ComponentProperty[]): void {
	if (properties.length === 0) return;
	doc.heading(2, "Properties").addBlank();
	doc.table(
		["Key", "Type", "Default", "Description"],
		properties.map((p) => [p.key, p.type, String(p.default ?? "—"), p.description ?? ""]),
	);
	doc.addBlank();
}

export function componentDocTemplate(vars: ComponentVariables, def: ComponentDefinition): Document {
	const doc = Document.create(vars.name);
	applyFrontmatter(doc, vars, def);

	doc.addBlank()
		.heading(1, vars.name)
		.addBlank();

	if (vars.description) doc.text(vars.description).addBlank();

	doc.heading(2, "Purpose").addBlank()
		.text("<!-- Describe what this component does and why it exists. -->")
		.addBlank();

	appendPropertiesTable(doc, def.properties);

	doc.heading(2, "Interfaces").addBlank()
		.text("<!-- List the public interfaces this component exposes. -->")
		.addBlank();

	doc.heading(2, "Dependencies").addBlank()
		.text("<!-- List components this depends on. -->")
		.addBlank();

	return doc;
}
