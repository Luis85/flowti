/**
 * component-doc.ts — Markdown documentation template for generic components.
 *
 * Uses the Document builder for YAML-safe frontmatter and standardized rendering.
 */

import { Document } from "../../../../infrastructure/document.js";
import type { CliDeps } from "../../../../infrastructure/deps.js";
import type { ComponentVariables, ComponentDefinition, ComponentProperty, ComponentAction, ComponentVariant, ComponentState, ComponentImage } from "../component-types.js";

export type TemplateDeps = Pick<CliDeps, "clock">;

function applyFrontmatter(doc: Document, vars: ComponentVariables, def: ComponentDefinition, deps: TemplateDeps): void {
	const meta = def.metadata;
	doc.setFrontmatter("type", String(meta.type ?? "component"));
	doc.setFrontmatter("status", String(meta.status ?? "draft"));
	doc.setFrontmatter("created", deps.clock.iso().slice(0, 10));
	if (vars.owner) doc.setFrontmatter("owner", vars.owner);
	if (def.domain) doc.setFrontmatter("domain", def.domain);
	if (def.icon) doc.setFrontmatter("icon", def.icon);
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

function appendActionsTable(doc: Document, actions: ComponentAction[]): void {
	if (actions.length === 0) return;
	doc.heading(2, "Actions").addBlank();
	doc.table(
		["Name", "Description"],
		actions.map((a) => [a.name, a.description ?? ""]),
	);
	doc.addBlank();
}

function appendVariantsTable(doc: Document, variants: ComponentVariant[]): void {
	if (variants.length === 0) return;
	doc.heading(2, "Variants").addBlank();
	doc.table(
		["Name", "Label", "Props"],
		variants.map((v) => [v.name, v.label ?? v.name, JSON.stringify(v.props)]),
	);
	doc.addBlank();
}

function appendImagesGallery(doc: Document, heroImage: string | undefined, images: ComponentImage[]): void {
	if (!heroImage && images.length === 0) return;
	doc.heading(2, "Images").addBlank();
	if (heroImage) doc.text(`![Hero](${heroImage})`).addBlank();
	for (const img of images) {
		const alt = img.alt ?? (img.role ? `[${img.role}]` : "image");
		doc.text(`![${alt}](${img.src})`);
	}
	if (images.length > 0) doc.addBlank();
}

function appendStatesTable(doc: Document, states: ComponentState[]): void {
	if (states.length === 0) return;
	doc.heading(2, "States").addBlank();
	doc.table(
		["Name", "Label", "Description", "Props"],
		states.map((s) => [s.name, s.label ?? s.name, s.description ?? "", JSON.stringify(s.props)]),
	);
	doc.addBlank();
}

export function componentDocTemplate(vars: ComponentVariables, def: ComponentDefinition, deps: TemplateDeps): Document {
	const doc = Document.create(vars.name);
	applyFrontmatter(doc, vars, def, deps);

	doc.addBlank()
		.heading(1, vars.name)
		.addBlank();

	if (vars.description) doc.text(vars.description).addBlank();

	appendImagesGallery(doc, def.heroImage, def.images ?? []);

	doc.heading(2, "Purpose").addBlank()
		.text("<!-- Describe what this component does and why it exists. -->")
		.addBlank();

	appendPropertiesTable(doc, def.properties);
	appendActionsTable(doc, def.actions ?? []);
	appendVariantsTable(doc, def.variants ?? []);
	appendStatesTable(doc, def.states ?? []);

	doc.heading(2, "Interfaces").addBlank()
		.text("<!-- List the public interfaces this component exposes. -->")
		.addBlank();

	doc.heading(2, "Dependencies").addBlank()
		.text("<!-- List components this depends on. -->")
		.addBlank();

	return doc;
}
