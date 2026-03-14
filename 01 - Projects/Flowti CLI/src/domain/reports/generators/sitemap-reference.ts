/**
 * sitemap-reference.ts — Generates a Sitemap Reference document.
 *
 * Documents all pages, navigation paths, action types, conditions,
 * and the page hierarchy defined in configs/sitemap.json.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { loadSitemap } from "../../../infrastructure/sitemap-loader.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { Sitemap, PageObject, PageAction } from "../../../infrastructure/sitemap-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateSitemapReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const sitemapPath = deps.paths.join(projectPath, "configs", "sitemap.json");
	const result = loadSitemap(sitemapPath, deps.disk);

	if (!result.ok || !result.sitemap) {
		return { success: false, outputPath: "", metrics: {}, error: result.errors.join("; ") || "Failed to load sitemap" };
	}

	const sitemap = result.sitemap;
	const pageIds = Object.keys(sitemap.pages);

	const doc = Document.create("Sitemap Reference")
		.mergeFrontmatter({
			type: "SitemapReference",
			date: deps.clock.iso(),
			pages: pageIds.length,
			tags: ["reference", "sitemap", "navigation"],
		})
		.addBlank()
		.heading(1, "Sitemap Reference")
		.addBlank()
		.text(`${pageIds.length} page(s) defined in \`configs/sitemap.json\`.`)
		.addBlank();

	appendPageIndex(doc, sitemap);
	appendPageDetails(doc, sitemap);
	appendNavigationGraph(doc, sitemap);

	const outputPath = svc.saveReference(doc, "Sitemap Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { pages: pageIds.length, actions: countActions(sitemap) },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendPageIndex(doc: Document, sitemap: Sitemap): void {
	doc.heading(2, "Pages").addBlank();
	doc.table(
		["Page", "Kind", "Label", "Actions"],
		Object.entries(sitemap.pages).map(([id, page]) => [
			`\`${id}\``,
			page.kind,
			page.label,
			String(page.actions.length),
		]),
	).addBlank();
}

function appendPageDetails(doc: Document, sitemap: Sitemap): void {
	for (const [id, page] of Object.entries(sitemap.pages)) {
		doc.heading(3, `${page.label} (\`${id}\`)`).addBlank();

		const meta: string[] = [];
		meta.push(`Kind: ${page.kind}`);
		if (page.domain) meta.push(`Domain: ${page.domain}`);
		if (page.status) meta.push(`Status: ${page.status}`);
		if (page.parent) meta.push(`Parent: \`${page.parent}\``);
		if (page.configPath) meta.push(`Config: \`${page.configPath}\``);
		doc.text(meta.join(" | ")).addBlank();

		appendPageActions(doc, page);
	}
}

function appendPageActions(doc: Document, page: PageObject): void {
	if (page.actions.length === 0) return;

	doc.table(
		["Key", "Label", "Type", "Target", "Conditions"],
		page.actions.map((action) => [
			`\`${action.key ?? "auto"}\``,
			action.label,
			action.type,
			describeTarget(action),
			describeConditions(action),
		]),
	).addBlank();
}

function describeTarget(action: PageAction): string {
	if (!action.target) return "—";
	switch (action.type) {
		case "navigate": return `→ \`${action.target}\``;
		case "command": return `⚡ \`${action.target}\``;
		case "handler": return `⚙ \`${action.target}\``;
		case "signal": return `↩ ${action.target}`;
		case "form": return `📝 \`${action.target}\``;
		default: return action.target;
	}
}

function describeConditions(action: PageAction): string {
	const parts: string[] = [];
	if (action.hidden !== undefined) parts.push(`hidden: \`${JSON.stringify(action.hidden)}\``);
	if (action.disabled !== undefined) parts.push(`disabled: \`${JSON.stringify(action.disabled)}\``);
	return parts.join(", ") || "—";
}

function appendNavigationGraph(doc: Document, sitemap: Sitemap): void {
	const edges: string[] = [];
	for (const [id, page] of Object.entries(sitemap.pages)) {
		for (const action of page.actions) {
			if (action.type === "navigate" && action.target) {
				edges.push(`\`${id}\` → \`${action.target}\` (${action.label})`);
			}
		}
	}
	if (edges.length === 0) return;

	doc.heading(2, "Navigation Graph").addBlank();
	doc.list(edges).addBlank();
}

function countActions(sitemap: Sitemap): number {
	let count = 0;
	for (const page of Object.values(sitemap.pages)) {
		count += page.actions.length;
	}
	return count;
}
