/**
 * sitemap-export.ts — Export sitemap views as markdown files with wikilinks.
 *
 * Each view becomes a markdown file with frontmatter containing metadata
 * and wikilink-based relations (up/down) for Obsidian navigation.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { Sitemap, ViewDefinition, SitemapEntry } from "../../infrastructure/sitemap-types.js";

export type SitemapExportDeps = Pick<CliDeps, "disk" | "paths">;

export interface SitemapExportResult {
	exported: number;
}

/** Export all sitemap views to markdown files in the given output directory. */
export function exportSitemapToMarkdown(sitemap: Sitemap, outputDir: string, deps: SitemapExportDeps): SitemapExportResult {
	deps.disk.mkdirSync(outputDir, { recursive: true });

	const childrenMap = buildChildrenMap(sitemap.views);
	let exported = 0;

	for (const [viewId, view] of Object.entries(sitemap.views)) {
		const doc = buildViewDocument(viewId, view, childrenMap);
		const filePath = deps.paths.join(outputDir, `${viewId}.md`);
		doc.save(filePath, deps.disk);
		exported++;
	}

	return { exported };
}

function buildChildrenMap(views: Record<string, ViewDefinition>): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const [viewId, view] of Object.entries(views)) {
		if (view.parent) {
			const children = map.get(view.parent) ?? [];
			children.push(viewId);
			map.set(view.parent, children);
		}
		if (!map.has(viewId)) map.set(viewId, []);
	}
	return map;
}

function buildViewDocument(viewId: string, view: ViewDefinition, childrenMap: Map<string, string[]>): Document {
	const doc = Document.create(view.title)
		.setFrontmatter("id", viewId)
		.setFrontmatter("title", view.title);

	addViewMeta(doc, view);
	addRelations(doc, viewId, view, childrenMap);

	doc.addBlank().heading(1, view.title);
	if (view.description) doc.addBlank().text(view.description);
	addCapabilities(doc, view);
	addItems(doc, view);

	return doc;
}

function addViewMeta(doc: Document, view: ViewDefinition): void {
	if (view.icon) doc.setFrontmatter("icon", view.icon);
	if (view.domain) doc.setFrontmatter("domain", view.domain);
	if (view.status) doc.setFrontmatter("status", view.status);
	if ("type" in view && view.type === "dynamic") doc.setFrontmatter("type", "dynamic");
}

function addRelations(doc: Document, viewId: string, view: ViewDefinition, childrenMap: Map<string, string[]>): void {
	if (view.parent) doc.setRawFrontmatter("up", `"[[${view.parent}]]"`);
	const children = childrenMap.get(viewId) ?? [];
	if (children.length > 0) {
		doc.setRawFrontmatter("down", `"${children.map((c) => `[[${c}]]`).join(", ")}"`);
	}
}

function addCapabilities(doc: Document, view: ViewDefinition): void {
	const caps = "capabilities" in view ? (view as { capabilities?: readonly string[] }).capabilities : undefined;
	if (caps && caps.length > 0) {
		doc.addBlank().heading(2, "Capabilities").addBlank().list([...caps]);
	}
}

function addItems(doc: Document, view: ViewDefinition): void {
	const items = view.items;
	if (!items || items.length === 0) return;
	doc.addBlank().heading(2, "Items");
	const rows = buildItemRows(items);
	if (rows.length > 0) doc.addBlank().table(["Key", "Label", "Action"], rows);
}

function itemAction(entry: { navigate?: string; handler?: string; signal?: string; command?: string }): string {
	if (entry.navigate) return `navigate → [[${entry.navigate}]]`;
	if (entry.handler) return `handler: ${entry.handler}`;
	if (entry.signal) return `signal: ${entry.signal}`;
	if (entry.command) return `command: ${entry.command}`;
	return "";
}

function buildItemRows(items: readonly SitemapEntry[]): string[][] {
	const rows: string[][] = [];
	for (const entry of items) {
		if (entry.type !== "item") continue;
		const key = entry.key ?? "";
		const label = entry.label ?? "";
		const action = itemAction(entry);
		rows.push([key, label, action]);
	}
	return rows;
}
