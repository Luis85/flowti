/**
 * component-catalog.ts — Generates a Product Component Catalog reference.
 *
 * Lists all components in the project with their kinds, domains, status,
 * C4 hierarchy, relationships, and product management metadata.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import {
	listProjectComponents,
	buildComponentTree,
	detectDirtyComponents,
	enrichComponentRelationships,
} from "../../make/component/component-list.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { ProjectComponent } from "../../make/component/component-types.js";

// ── Kind labels ──────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
	component: "Component",
	"ui-component": "UI Component",
	layout: "Layout",
	page: "Page",
	system: "System",
	container: "Container",
	"c4-component": "C4 Component",
	person: "Person",
};

// ── Generator ────────────────────────────────────────────────────────

export function generateComponentCatalog(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const components = listProjectComponents(projectPath, deps);
	enrichComponentRelationships(components);
	detectDirtyComponents(projectPath, components, deps);

	if (components.length === 0) {
		return {
			success: true,
			outputPath: "",
			metrics: { total: 0 },
			warnings: ["No components found in project"],
		};
	}

	const tree = buildComponentTree(components);
	const domains = [...new Set(components.map((c) => c.domain).filter(Boolean))] as string[];
	const dirty = components.filter((c) => c.isDirty);
	const products = components.filter((c) => c.role === "product");

	const doc = Document.create("Product Component Catalog")
		.mergeFrontmatter({
			type: "ComponentCatalog",
			date: deps.clock.iso(),
			total: components.length,
			domains: domains.length,
			dirty: dirty.length,
			tags: ["reference", "components", "architecture"],
		})
		.addBlank()
		.heading(1, "Product Component Catalog")
		.addBlank()
		.text(`${components.length} component(s) across ${domains.length} domain(s).${dirty.length > 0 ? ` ${dirty.length} dirty.` : ""}`)
		.addBlank();

	appendSummaryTable(doc, components);
	appendC4Tree(doc, components, tree);
	appendByDomain(doc, components, domains);
	appendProducts(doc, products, components);
	appendDirtyList(doc, dirty);

	const outputPath = svc.saveReference(doc, "Product Component Catalog.md");

	return {
		success: true,
		outputPath,
		metrics: { total: components.length, domains: domains.length, dirty: dirty.length, products: products.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendSummaryTable(doc: Document, components: ProjectComponent[]): void {
	doc.heading(2, "All Components").addBlank();
	doc.table(
		["Component", "Kind", "Domain", "Status", "Priority", "Role"],
		components.map((c) => [
			Document.wikilink(c.name),
			KIND_LABELS[c.kind] ?? c.kind,
			c.domain ?? "—",
			c.status,
			c.priority ?? "—",
			c.role ?? "—",
		]),
	).addBlank();
}

function appendC4Tree(doc: Document, components: ProjectComponent[], tree: { component: ProjectComponent; depth: number }[]): void {
	const c4Components = components.filter((c) => c.c4Level != null);
	if (c4Components.length === 0) return;
	doc.heading(2, "C4 Architecture Tree").addBlank();
	for (const { component: c, depth } of tree) {
		if (c.c4Level == null) continue;
		const indent = "  ".repeat(depth);
		doc.text(`${indent}- ${Document.wikilink(c.name)} *(${KIND_LABELS[c.kind] ?? c.kind})*`);
	}
	doc.addBlank();
}

function appendByDomain(doc: Document, components: ProjectComponent[], domains: string[]): void {
	if (domains.length === 0) return;
	doc.heading(2, "By Domain").addBlank();
	for (const domain of domains.sort()) {
		const domainComponents = components.filter((c) => c.domain === domain);
		doc.heading(3, domain).addBlank();
		doc.list(domainComponents.map((c) => `${Document.wikilink(c.name)} — ${KIND_LABELS[c.kind] ?? c.kind} (${c.status})`));
		doc.addBlank();
	}
}

function appendProducts(doc: Document, products: ProjectComponent[], all: ProjectComponent[]): void {
	if (products.length === 0) return;
	doc.heading(2, "Products").addBlank();
	for (const product of products) {
		appendProductSummary(doc, product, all);
	}
}

function appendDirtyList(doc: Document, dirty: ProjectComponent[]): void {
	if (dirty.length === 0) return;
	doc.heading(2, "Dirty Components").addBlank()
		.text("These components have a newer JSON definition than their generated files and need regeneration.")
		.addBlank();
	doc.list(dirty.map((c) => Document.wikilink(c.name))).addBlank();
}

function appendProductSummary(doc: Document, product: ProjectComponent, all: ProjectComponent[]): void {
	const features = all.filter(
		(c) => c.features?.length || (c.containedBy === product.name && c.role === "feature"),
	);
	doc.heading(3, product.name).addBlank();
	doc.text(`Status: ${product.status}${product.priority ? ` | Priority: ${product.priority}` : ""}`).addBlank();
	if (features.length > 0) {
		doc.text(`Features: ${features.map((f) => Document.wikilink(f.name)).join(", ")}`).addBlank();
	}
}
