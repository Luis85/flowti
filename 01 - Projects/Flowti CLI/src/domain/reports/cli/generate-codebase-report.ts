/**
 * generate-codebase-report.ts — CLI project codebase report generator.
 *
 * Reads the TypeDoc codebase.json produced by `npm run typedoc` and
 * generates a markdown CodebaseReport.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

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

function countOf(counts: Record<number, number>, kind: number): number {
	return counts[kind] || 0;
}

function buildFrontmatter(data: TypeDocNode, counts: Record<number, number>, clock: ReportDeps["clock"]): Record<string, string | number> {
	return {
		type: "CodebaseReport",
		project: "flowti-cli",
		date: clock.iso(),
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

export function generateCodebaseReport(projectPath: string, deps: ReportDeps, ctx?: import("../../../infrastructure/pipeline/pipeline-types.js").PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const codebaseJson = svc.subdir("codebase/codebase.json");

	if (!deps.disk.existsSync(codebaseJson)) {
		log("[cli-report] No codebase.json found — run `npm run typedoc` first.");
		return { success: false, outputPath: "", metrics: {} };
	}

	const data: TypeDocNode = JSON.parse(deps.disk.readFileSync(codebaseJson, "utf-8"));
	const counts = countByKind(data);
	const domains = countModulesByDomain(data);
	const fm = buildFrontmatter(data, counts, deps.clock);

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
		sourceJson: codebaseJson,
	});

	log(`[cli-report] Codebase Report`);
	log(`  Modules: ${fm.modules} | Classes: ${fm.classes} | Interfaces: ${fm.interfaces}`);
	log(`  Functions: ${fm.functions} | Type Aliases: ${fm.type_aliases}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { modules: fm.modules as number, classes: fm.classes as number, interfaces: fm.interfaces as number, functions: fm.functions as number },
	};
}