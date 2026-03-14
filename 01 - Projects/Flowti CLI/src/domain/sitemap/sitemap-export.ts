/**
 * sitemap-export.ts — Export sitemap pages as markdown files with wikilinks.
 *
 * Each page becomes a markdown file with frontmatter containing metadata
 * and wikilink-based relations (up/down) for Obsidian navigation.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { Sitemap, PageObject, PageAction } from "../../infrastructure/sitemap-types.js";

export type SitemapExportDeps = Pick<CliDeps, "disk" | "paths">;

export interface SitemapExportResult {
	exported: number;
}

/** Export all sitemap pages to markdown files in the given output directory. */
export function exportSitemapToMarkdown(sitemap: Sitemap, outputDir: string, deps: SitemapExportDeps): SitemapExportResult {
	deps.disk.mkdirSync(outputDir, { recursive: true });

	const childrenMap = buildChildrenMap(sitemap.pages);
	let exported = 0;

	for (const [pageId, page] of Object.entries(sitemap.pages)) {
		const doc = buildPageDocument(pageId, page, childrenMap);
		const filePath = deps.paths.join(outputDir, `${pageId}.md`);
		doc.save(filePath, deps.disk);
		exported++;
	}

	return { exported };
}

function buildChildrenMap(pages: Record<string, PageObject>): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const [pageId, page] of Object.entries(pages)) {
		if (page.parent) {
			const children = map.get(page.parent) ?? [];
			children.push(pageId);
			map.set(page.parent, children);
		}
		if (!map.has(pageId)) map.set(pageId, []);
	}
	return map;
}

function buildPageDocument(pageId: string, page: PageObject, childrenMap: Map<string, string[]>): Document {
	const doc = Document.create(page.label)
		.setFrontmatter("id", pageId)
		.setFrontmatter("label", page.label)
		.setFrontmatter("kind", page.kind);

	addPageMeta(doc, page);
	addRelations(doc, pageId, page, childrenMap);

	doc.addBlank().heading(1, page.label);
	if (page.description) doc.addBlank().text(page.description);
	addActions(doc, page);

	return doc;
}

function addPageMeta(doc: Document, page: PageObject): void {
	if (page.icon) doc.setFrontmatter("icon", page.icon);
	if (page.domain) doc.setFrontmatter("domain", page.domain);
	if (page.status) doc.setFrontmatter("status", page.status);
}

function addRelations(doc: Document, pageId: string, page: PageObject, childrenMap: Map<string, string[]>): void {
	if (page.parent) doc.setRawFrontmatter("up", `"[[${page.parent}]]"`);
	const children = childrenMap.get(pageId) ?? [];
	if (children.length > 0) {
		doc.setRawFrontmatter("down", `"${children.map((c) => `[[${c}]]`).join(", ")}"`);
	}
}

function addActions(doc: Document, page: PageObject): void {
	if (page.actions.length === 0) return;
	doc.addBlank().heading(2, "Actions");
	const rows = buildActionRows(page.actions);
	if (rows.length > 0) doc.addBlank().table(["Key", "Label", "Action"], rows);
}

function actionDescription(action: PageAction): string {
	if (!action.target) return "";
	switch (action.type) {
		case "navigate": return `navigate → [[${action.target}]]`;
		case "handler": return `handler: ${action.target}`;
		case "signal": return `signal: ${action.target}`;
		case "command": return `command: ${action.target}`;
		case "form": return `form → [[${action.target}]]`;
		default: return "";
	}
}

function buildActionRows(actions: readonly PageAction[]): string[][] {
	const rows: string[][] = [];
	for (const action of actions) {
		const key = action.key ?? "";
		const label = action.label;
		const desc = actionDescription(action);
		rows.push([key, label, desc]);
	}
	return rows;
}
