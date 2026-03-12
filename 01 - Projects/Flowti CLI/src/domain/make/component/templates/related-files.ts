/**
 * related-files.ts — Builds a "Related Files" section with Obsidian wikilinks.
 *
 * Used by component-doc and c4-doc templates to link to sibling generated files.
 */

import { Document } from "../../../../infrastructure/document.js";
import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

/** Interpolate {{variable}} placeholders in a path string. */
function interpolatePath(template: string, vars: ComponentVariables): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Extract the filename (without extension) from a path. */
function basename(filePath: string): string {
	const name = filePath.split("/").pop() ?? filePath;
	const dotIdx = name.indexOf(".");
	return dotIdx > 0 ? name.slice(0, dotIdx) : name;
}

/** Build the "Related Files" section with wikilinks to all sibling generated files. */
export function buildRelatedFilesSection(doc: Document, vars: ComponentVariables, def: ComponentDefinition): void {
	const links: string[] = [];
	for (const f of def.files) {
		const resolved = interpolatePath(f.path, vars);
		const filename = resolved.split("/").pop() ?? resolved;
		// Skip the .md file itself (that's the current document)
		if (filename.endsWith(".md")) continue;
		links.push(`- ${Document.wikilink(basename(filename), filename)}`);
	}
	if (links.length === 0) return;
	doc.heading(2, "Related Files").addBlank();
	for (const link of links) doc.text(link);
	doc.addBlank();
}
