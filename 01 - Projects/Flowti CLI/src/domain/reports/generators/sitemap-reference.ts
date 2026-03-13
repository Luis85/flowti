/**
 * sitemap-reference.ts — Generates a Sitemap Reference document.
 *
 * Documents all views, navigation paths, item types, conditions,
 * and the view hierarchy defined in configs/sitemap.json.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { loadSitemap } from "../../../infrastructure/sitemap-loader.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { Sitemap, ViewDefinition, SitemapItem } from "../../../infrastructure/sitemap-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateSitemapReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const sitemapPath = deps.paths.join(projectPath, "configs", "sitemap.json");
	const result = loadSitemap(sitemapPath, deps.disk);

	if (!result.ok || !result.sitemap) {
		return { success: false, outputPath: "", metrics: {}, error: result.errors.join("; ") || "Failed to load sitemap" };
	}

	const sitemap = result.sitemap;
	const viewIds = Object.keys(sitemap.views);

	const doc = Document.create("Sitemap Reference")
		.mergeFrontmatter({
			type: "SitemapReference",
			date: deps.clock.iso(),
			views: viewIds.length,
			tags: ["reference", "sitemap", "navigation"],
		})
		.addBlank()
		.heading(1, "Sitemap Reference")
		.addBlank()
		.text(`${viewIds.length} view(s) defined in \`configs/sitemap.json\`.`)
		.addBlank();

	appendViewIndex(doc, sitemap);
	appendViewDetails(doc, sitemap);
	appendNavigationGraph(doc, sitemap);

	const outputPath = svc.saveReference(doc, "Sitemap Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { views: viewIds.length, items: countItems(sitemap) },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendViewIndex(doc: Document, sitemap: Sitemap): void {
	doc.heading(2, "Views").addBlank();
	doc.table(
		["View", "Type", "Title", "Items"],
		Object.entries(sitemap.views).map(([id, view]) => [
			`\`${id}\``,
			view.type === "dynamic" ? "Dynamic" : "Menu",
			view.title,
			String(view.items?.length ?? 0),
		]),
	).addBlank();
}

function appendViewDetails(doc: Document, sitemap: Sitemap): void {
	for (const [id, view] of Object.entries(sitemap.views)) {
		doc.heading(3, `${view.title} (\`${id}\`)`).addBlank();

		const meta: string[] = [];
		if (view.type === "dynamic") meta.push(`Handler: \`${(view as ViewDefinition & { handler?: string }).handler}\``);
		if (view.domain) meta.push(`Domain: ${view.domain}`);
		if (view.status) meta.push(`Status: ${view.status}`);
		if (view.parent) meta.push(`Parent: \`${view.parent}\``);
		if (meta.length > 0) doc.text(meta.join(" | ")).addBlank();

		appendViewItems(doc, view);
	}
}

function appendViewItems(doc: Document, view: ViewDefinition): void {
	const items = view.items;
	if (!items || items.length === 0) return;

	const menuItems = items.filter((e): e is SitemapItem => "key" in e && !("separator" in e) && !("slot" in e));
	if (menuItems.length === 0) return;

	doc.table(
		["Key", "Label", "Action", "Conditions"],
		menuItems.map((item) => [
			`\`${item.key}\``,
			item.label,
			describeAction(item),
			describeConditions(item),
		]),
	).addBlank();
}

function describeAction(item: SitemapItem): string {
	if (item.navigate) return `→ \`${item.navigate}\``;
	if (item.command) return `⚡ \`${item.command}\``;
	if (item.handler) return `⚙ \`${item.handler}\``;
	if (item.signal) return `↩ ${item.signal}`;
	return "—";
}

function describeConditions(item: SitemapItem): string {
	const parts: string[] = [];
	if (item.hidden !== undefined) parts.push(`hidden: \`${JSON.stringify(item.hidden)}\``);
	if (item.disabled !== undefined) parts.push(`disabled: \`${JSON.stringify(item.disabled)}\``);
	return parts.join(", ") || "—";
}

function appendNavigationGraph(doc: Document, sitemap: Sitemap): void {
	const edges: string[] = [];
	for (const [id, view] of Object.entries(sitemap.views)) {
		const items = view.items ?? [];
		for (const entry of items) {
			if ("navigate" in entry && (entry as SitemapItem).navigate) {
				edges.push(`\`${id}\` → \`${(entry as SitemapItem).navigate}\` (${(entry as SitemapItem).label})`);
			}
		}
	}
	if (edges.length === 0) return;

	doc.heading(2, "Navigation Graph").addBlank();
	doc.list(edges).addBlank();
}

function countItems(sitemap: Sitemap): number {
	let count = 0;
	for (const view of Object.values(sitemap.views)) {
		count += view.items?.length ?? 0;
	}
	return count;
}
