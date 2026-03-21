/**
 * Pure functions for generating TypeDoc markdown content.
 * Extracted from configDocContent to reduce file size.
 */

import { basename, stripExtension } from "../../utils/pathUtils";
import {
	getPropertyDocPath,
	getPipelineDocPath,
	getConfigDocPath,
} from "./configDocContent";

export interface TypeDocContext {
	docsRoot: string;
	pipelines: Array<{ name: string; sources: Array<{ columnMappings: Array<{ included: boolean }> }> }>;
	importConfigs: Array<{ name: string }>;
	exportConfigs: Array<{ name: string }>;
}

export function buildTypeDocContent(
	typeName: string,
	properties: string[],
	ctx: TypeDocContext,
	userNotes?: string,
): string {
	const now = new Date().toISOString();
	const totalConfigs = ctx.pipelines.length + ctx.importConfigs.length + ctx.exportConfigs.length;

	const lines: string[] = [
		"---",
		"type: TypeDoc",
		`name: "${typeName}"`,
		`description: ""`,
		`properties: [${properties.map((p) => `"${p}"`).join(", ")}]`,
		`pipelines: ${totalConfigs}`,
		`created: "${now}"`,
		"---",
		"",
		`# ${typeName}`,
		"",
		"> Note type definition.",
		"",
		"## Overview",
		"",
		`- **Type**: \`${typeName}\``,
		`- **Expected Properties**: ${properties.length}`,
		`- **Used by Configs**: ${totalConfigs}`,
		"",
	];

	if (properties.length > 0) {
		lines.push("## Expected Properties", "");
		lines.push("| Property | Documented |");
		lines.push("| -------- | ---------- |");
		for (const prop of properties) {
			const propDocPath = getPropertyDocPath(ctx.docsRoot, prop);
			const propDocName = stripExtension(basename(propDocPath), ".md") || prop;
			lines.push(`| [[${propDocName}\\|${prop}]] | — |`);
		}
		lines.push("");
	}

	if (totalConfigs > 0) {
		lines.push("## Configs", "");
		for (const pipe of ctx.pipelines) {
			const pipeDocPath = getPipelineDocPath(ctx.docsRoot, pipe.name);
			const pipeDocName = stripExtension(basename(pipeDocPath), ".md") || pipe.name;
			lines.push(`- [[${pipeDocName}\\|${pipe.name}]] — Pipeline (${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""})`);
		}
		for (const cfg of ctx.importConfigs) {
			const docPath = getConfigDocPath(ctx.docsRoot, cfg.name, "import");
			const docName = stripExtension(basename(docPath), ".md") || cfg.name;
			lines.push(`- [[${docName}\\|${cfg.name}]] — Import`);
		}
		for (const cfg of ctx.exportConfigs) {
			const docPath = getConfigDocPath(ctx.docsRoot, cfg.name, "export");
			const docName = stripExtension(basename(docPath), ".md") || cfg.name;
			lines.push(`- [[${docName}\\|${cfg.name}]] — Export`);
		}
		lines.push("");
	}

	// Lifecycle event wikilinks
	const lowerType = typeName.toLowerCase();
	const crudSuffixes = [
		{ suffix: "created", label: "Created" },
		{ suffix: "read", label: "Read" },
		{ suffix: "updated", label: "Updated" },
		{ suffix: "deleted", label: "Deleted" },
	];
	lines.push("## Lifecycle Events", "");
	for (const crud of crudSuffixes) {
		const eventType = `${lowerType}.${crud.suffix}`;
		lines.push(`- [[${eventType}\\|${eventType}]] — ${crud.label}`);
	}
	lines.push("");

	if (userNotes !== undefined) {
		lines.push("## Notes", "", userNotes);
	} else {
		lines.push("## Notes", "", "> Describe this type, its purpose, and usage guidelines.", "");
	}

	return lines.join("\n");
}
