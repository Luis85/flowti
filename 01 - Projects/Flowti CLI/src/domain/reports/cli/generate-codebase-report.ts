/**
 * generate-codebase-report.ts — CLI project codebase report generator.
 *
 * Reads the TypeDoc codebase.json produced by `npm run docs` and
 * generates a markdown CodebaseReport.
 *
 * Usage: tsx src/domain/reports/cli/generate-codebase-report.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";

const svc = new ReportService();
const CODEBASE_JSON = svc.subdir("codebase/codebase.json");

const KIND: Record<string, number> = {
	MODULE: 2,
	FUNCTION: 64,
	CLASS: 128,
	INTERFACE: 256,
	CONSTRUCTOR: 512,
	PROPERTY: 1024,
	METHOD: 2048,
	TYPE_ALIAS: 2097152,
};

interface TypeDocNode {
	kind?: number;
	name?: string;
	children?: TypeDocNode[];
	schemaVersion?: string;
}

function countByKind(node: TypeDocNode): Record<number, number> {
	const counts: Record<number, number> = {};

	function walk(n: TypeDocNode): void {
		if (n.kind != null) {
			counts[n.kind] = (counts[n.kind] || 0) + 1;
		}
		for (const child of n.children || []) walk(child);
	}

	walk(node);
	return counts;
}

function countModulesByDomain(node: TypeDocNode): Record<string, number> {
	const domains: Record<string, number> = {};

	function walk(n: TypeDocNode): void {
		if (n.kind === KIND.MODULE && n.name) {
			const parts = n.name.replace(/^src\//, "").split("/");
			const domain = parts[0] || "root";
			domains[domain] = (domains[domain] || 0) + 1;
		}
		for (const child of n.children || []) walk(child);
	}

	walk(node);
	return domains;
}

function buildFrontmatter(data: TypeDocNode, counts: Record<number, number>): Record<string, string | number> {
	return {
		type: "CodebaseReport",
		project: "flowti-cli",
		date: clock.iso(),
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
}

function main(): void {
	if (!disk.existsSync(CODEBASE_JSON)) {
		log("[cli-report] No codebase.json found — run `npm run docs` first.");
		return;
	}

	const data: TypeDocNode = JSON.parse(disk.readFileSync(CODEBASE_JSON, "utf-8"));
	const counts = countByKind(data);
	const domains = countModulesByDomain(data);
	const fm = buildFrontmatter(data, counts);

	const doc = Document.create("CLI Codebase Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Codebase Report")
		.addBlank()
		.callout("info", "Summary", [
			`Modules: ${fm.modules} | Classes: ${fm.classes} | Interfaces: ${fm.interfaces}`,
			`Functions: ${fm.functions} | Type Aliases: ${fm.type_aliases}`,
			`Methods: ${fm.methods} | Properties: ${fm.properties}`,
		])
		.addBlank();

	if (Object.keys(domains).length > 0) {
		doc.heading(2, "Modules by Domain").addBlank();
		const rows = Object.entries(domains)
			.sort((a, b) => b[1] - a[1])
			.map(([domain, count]) => [domain, String(count)]);
		doc.table(["Domain", "Modules"], rows, { alignRight: [1] }).addBlank();
	}

	const outputPath = svc.save(doc, {
		subdir: "codebase",
		slug: "codebase-report",
		stableFilename: "Codebase Report.md",
		sourceJson: CODEBASE_JSON,
	});

	log(`[cli-report] CodebaseReport written: ${outputPath}`);
}

main();
