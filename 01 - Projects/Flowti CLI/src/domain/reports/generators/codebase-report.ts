/**
 * generate-codebase-report.ts
 *
 * Reads the TypeDoc codebase.json and generates a CodebaseReport vault note
 * with queryable YAML frontmatter summarizing project structure metrics.
 *
 * Usage: node scripts/generate-codebase-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const CODEBASE_JSON = path.join(ROOT, "docs", "reports", "codebase", "codebase.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "codebase");

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

function main(): void {
	if (!fs.existsSync(CODEBASE_JSON)) {
		console.log("[report] No codebase.json found — run typedoc first.");
		return;
	}

	const data: TypeDocNode = JSON.parse(fs.readFileSync(CODEBASE_JSON, "utf-8"));
	const now = new Date();
	const date = now.toISOString();
	const counts = countByKind(data);

	const fm: Record<string, string | number> = {
		type: "CodebaseReport",
		date,
		schema_version: data.schemaVersion || "unknown",
		modules: counts[KIND.MODULE] || 0,
		classes: counts[KIND.CLASS] || 0,
		interfaces: counts[KIND.INTERFACE] || 0,
		functions: counts[KIND.FUNCTION] || 0,
		type_aliases: counts[KIND.TYPE_ALIAS] || 0,
		methods: counts[KIND.METHOD] || 0,
		properties: counts[KIND.PROPERTY] || 0,
		constructors: counts[KIND.CONSTRUCTOR] || 0,
	};

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

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-codebase-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] CodebaseReport written: ${outputPath}`);
}

main();
