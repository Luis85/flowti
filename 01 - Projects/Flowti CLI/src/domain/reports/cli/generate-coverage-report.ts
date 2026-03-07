/**
 * generate-coverage-report.ts — CLI project coverage report generator.
 *
 * Reads V8 coverage-final.json produced by vitest --coverage
 * and generates a markdown CoverageReport for the CLI project.
 *
 * Usage: tsx src/domain/reports/cli/generate-coverage-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const COVERAGE_JSON = path.join(CLI_PROJECT, "docs", "reports", "coverage", "coverage-final.json");
const OUTPUT_DIR = path.join(CLI_PROJECT, "docs", "reports", "coverage");

interface CoverageEntry {
	path: string;
	s?: Record<string, number>;
	b?: Record<string, number[]>;
	f?: Record<string, number>;
}

function computeCoverage(entries: CoverageEntry[], kind: "statements" | "branches" | "functions"): number {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		if (kind === "statements") {
			for (const v of Object.values(entry.s ?? {})) { total++; if (v > 0) covered++; }
		} else if (kind === "branches") {
			for (const branches of Object.values(entry.b ?? {})) {
				for (const v of branches) { total++; if (v > 0) covered++; }
			}
		} else {
			for (const v of Object.values(entry.f ?? {})) { total++; if (v > 0) covered++; }
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

function main(): void {
	if (!fs.existsSync(COVERAGE_JSON)) {
		console.log("[cli-report] No coverage-final.json found — run vitest --coverage first.");
		return;
	}

	const json: Record<string, CoverageEntry> = JSON.parse(fs.readFileSync(COVERAGE_JSON, "utf-8"));
	const entries = Object.values(json);
	const now = new Date();

	const stmtPct = computeCoverage(entries, "statements");
	const branchPct = computeCoverage(entries, "branches");
	const fnPct = computeCoverage(entries, "functions");

	const fm: Record<string, string | number> = {
		type: "CoverageReport",
		project: "flowti-cli",
		date: now.toISOString(),
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

	// Per-file breakdown
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

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const outputPath = path.join(OUTPUT_DIR, `${safeTimestamp}-coverage-report.md`);
	doc.save(outputPath);
	doc.save(path.join(OUTPUT_DIR, "Coverage Report.md"));

	console.log(`[cli-report] CoverageReport written: ${outputPath}`);
}

main();
