/**
 * generate-codebase-report.ts
 *
 * Reads the TypeDoc codebase.json and generates a CodebaseReport vault note
 * with queryable YAML frontmatter summarizing project structure metrics.
 *
 * Usage: node scripts/generate-codebase-report.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

import { clock } from "../../../infrastructure/clock.js";

const CODEBASE_JSON = paths.join(PLUGIN_ROOT, "docs", "reports", "codebase", "codebase.json");
const OUTPUT_DIR = paths.join(PLUGIN_ROOT, "docs", "reports", "codebase");

/** TypeDoc reflection kind values */
const KIND: Record<string, number> = {
	MODULE: 2,
	FUNCTION: 64,
	CLASS: 128,
	INTERFACE: 256,
	CONSTRUCTOR: 512,
	PROPERTY: 1024,
	METHOD: 2048,
	TYPE_ALIAS: 2097152,
	GET_SIGNATURE: 262144,
	REFERENCE: 4194304,
};

interface TypeDocNode {
	kind?: number;
	children?: TypeDocNode[];
	schemaVersion?: string;
}

function countByKind(node: TypeDocNode): Record<number, number> {
	const counts: Record<number, number> = {};

	function walk(n: TypeDocNode): void {
		if (n.kind != null) {
			counts[n.kind] = (counts[n.kind] || 0) + 1;
		}
		for (const child of n.children || []) {
			walk(child);
		}
	}

	walk(node);
	return counts;
}

function countOf(counts: Record<number, number>, kind: number): number {
	return counts[kind] || 0;
}

function buildCodebaseFm(data: TypeDocNode, counts: Record<number, number>, date: string): Record<string, string | number> {
	return {
		type: "CodebaseReport",
		date,
		schema_version: data.schemaVersion || "unknown",
		modules: countOf(counts, KIND.MODULE),
		classes: countOf(counts, KIND.CLASS),
		interfaces: countOf(counts, KIND.INTERFACE),
		functions: countOf(counts, KIND.FUNCTION),
		type_aliases: countOf(counts, KIND.TYPE_ALIAS),
		methods: countOf(counts, KIND.METHOD),
		properties: countOf(counts, KIND.PROPERTY),
		constructors: countOf(counts, KIND.CONSTRUCTOR),
	};
}

function main(): void {
	if (!disk.existsSync(CODEBASE_JSON)) {
		return;
	}

	const data: TypeDocNode = JSON.parse(disk.readFileSync(CODEBASE_JSON, "utf-8"));
	const now = clock.now();
	const counts = countByKind(data);
	const fm = buildCodebaseFm(data, counts, now.toISOString());

	const doc = Document.create("Codebase Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Codebase Report")
		.addBlank()
		.callout("info", "Summary", [
			`Modules: ${fm.modules} | Classes: ${fm.classes} | Interfaces: ${fm.interfaces}`,
			`Functions: ${fm.functions} | Type Aliases: ${fm.type_aliases}`,
			`Methods: ${fm.methods} | Properties: ${fm.properties}`,
		])
		.addBlank();

	const safeTimestamp = clock.safeIso();
	const outputPath = paths.join(OUTPUT_DIR, `${safeTimestamp}-codebase-report.md`);
	doc.save(outputPath);
}

main();
