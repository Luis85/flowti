/**
 * generate-coverage-report.ts — CLI project coverage report generator.
 *
 * Reads V8 coverage-final.json produced by vitest --coverage
 * and generates a markdown CoverageReport.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

interface CoverageEntry {
	path: string;
	s?: Record<string, number>;
	b?: Record<string, number[]>;
	f?: Record<string, number>;
}

function collectCounts(entry: CoverageEntry, kind: "statements" | "branches" | "functions"): number[] {
	if (kind === "statements") return Object.values(entry.s ?? {});
	if (kind === "branches") return Object.values(entry.b ?? {}).flat();
	return Object.values(entry.f ?? {});
}

function computeCoverage(entries: CoverageEntry[], kind: "statements" | "branches" | "functions"): number {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		for (const v of collectCounts(entry, kind)) {
			total++;
			if (v > 0) covered++;
		}
	}

	return total === 0 ? 0 : Math.round((covered / total) * 10000) / 100;
}

function fileCoverage(entry: CoverageEntry): { statements: number; branches: number; functions: number } {
	return {
		statements: computeCoverage([entry], "statements"),
		branches: computeCoverage([entry], "branches"),
		functions: computeCoverage([entry], "functions"),
	};
}

export function generateCoverageReport(projectPath: string, deps: ReportDeps, ctx?: import("../../../infrastructure/pipeline/pipeline-types.js").PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const coverageJson = svc.dataPath("coverage/coverage-final.json");

	if (!deps.disk.existsSync(coverageJson)) {
		log("[cli-report] No coverage-final.json found — run vitest --coverage first.");
		return { success: false, outputPath: "", metrics: {} };
	}

	const json: Record<string, CoverageEntry> = JSON.parse(deps.disk.readFileSync(coverageJson, "utf-8"));
	const entries = Object.values(json);

	const stmtPct = computeCoverage(entries, "statements");
	const branchPct = computeCoverage(entries, "branches");
	const fnPct = computeCoverage(entries, "functions");

	const fm: Record<string, string | number> = {
		type: "CoverageReport",
		project: "flowti-cli",
		date: deps.clock.iso(),
		statements_pct: stmtPct,
		branches_pct: branchPct,
		functions_pct: fnPct,
		files_covered: entries.length,
	};

	const doc = Document.create("CLI Coverage Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Coverage Report")
		.addBlank()
		.callout("info", "Summary", [
			`Statements: ${stmtPct}% | Branches: ${branchPct}% | Functions: ${fnPct}%`,
			`Files: ${entries.length}`,
		])
		.addBlank();

	const rows = entries
		.map((entry) => {
			const rel = entry.path.replace(/\\/g, "/").split("Flowti CLI/").pop() ?? entry.path;
			const cov = fileCoverage(entry);
			return { rel, ...cov };
		})
		.sort((a, b) => a.statements - b.statements);

	doc.heading(2, "Files").addBlank();
	doc.table(
		["File", "Stmts %", "Branch %", "Fn %"],
		rows.map((r) => [`\`${r.rel}\``, `${r.statements}`, `${r.branches}`, `${r.functions}`]),
		{ alignRight: [1, 2, 3] },
	).addBlank();

	const outputPath = svc.save(doc, {
		subdir: "coverage",
		slug: "coverage-report",
		stableFilename: "Coverage Report.md",
		sourceJson: coverageJson,
	});

	log(`[cli-report] Coverage Report`);
	log(`  Statements: ${stmtPct}% | Branches: ${branchPct}% | Functions: ${fnPct}%`);
	log(`  Files: ${entries.length}`);
	log(`  Written: ${outputPath}`);

	const warnings: string[] = [];
	if (stmtPct < 80) warnings.push(`Statement coverage ${stmtPct}% (< 80%)`);
	if (branchPct < 70) warnings.push(`Branch coverage ${branchPct}% (< 70%)`);

	return {
		success: true,
		outputPath,
		metrics: { statements: stmtPct, branches: branchPct, functions: fnPct, files: entries.length },
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}