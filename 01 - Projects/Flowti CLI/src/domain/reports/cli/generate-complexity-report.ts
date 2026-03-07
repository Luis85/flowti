/**
 * generate-complexity-report.ts — CLI project complexity report generator.
 *
 * Reads coverage/analysis.json (produced by `npm run analysis`) and generates
 * a markdown ComplexityReport with coverage, decision points, and top files.
 *
 * Usage: npm run analysis && tsx src/domain/reports/cli/generate-complexity-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const ANALYSIS_JSON = path.join(CLI_PROJECT, "coverage", "analysis.json");
const OUTPUT_DIR = path.join(CLI_PROJECT, "docs", "reports", "complexity");
const STABLE_PATH = path.join(CLI_PROJECT, "docs", "reports", "Complexity Report.md");

// ── Types matching analysis.json shape ──────────────────────────────

interface DecisionPoint { line: number; type: string; functionLine: number }
interface AnalysisFile {
	file: string;
	decisionPointCount: number;
	decisionPoints: DecisionPoint[];
	statements?: number;
	branches?: number;
	functions?: number;
	lines?: number;
	uncoveredLineRanges?: string[];
}
interface AnalysisSummary {
	statements?: number;
	branches?: number;
	functions?: number;
	lines?: number;
	totalDecisionPoints: number;
	filesWithDecisionPoints: number;
}
interface AnalysisData {
	summary: AnalysisSummary;
	files: AnalysisFile[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function relPath(absPath: string): string {
	const rootNorm = CLI_PROJECT.replace(/\\/g, "/");
	const norm = absPath.replace(/\\/g, "/");
	return norm.startsWith(rootNorm) ? norm.substring(rootNorm.length + 1) : norm;
}

function pct(value: number | undefined): string {
	return value !== undefined ? `${value.toFixed(1)}%` : "—";
}

// ── Main ────────────────────────────────────────────────────────────

function main(): void {
	if (!fs.existsSync(ANALYSIS_JSON)) {
		console.log("[cli-report] No coverage/analysis.json found — run `npm run analysis` first.");
		return;
	}

	const data: AnalysisData = JSON.parse(fs.readFileSync(ANALYSIS_JSON, "utf-8"));
	const { summary, files } = data;
	const now = new Date();

	const hasCoverage = summary.statements !== undefined;
	const srcFiles = files.filter((f) => !relPath(f.file).startsWith("bin/"));

	const fm: Record<string, string | number> = {
		type: "ComplexityReport",
		project: "flowti-cli",
		date: now.toISOString(),
		total_files: srcFiles.length,
		total_decision_points: summary.totalDecisionPoints,
	};
	if (hasCoverage) {
		fm.statement_coverage = summary.statements!;
		fm.branch_coverage = summary.branches!;
		fm.function_coverage = summary.functions!;
		fm.line_coverage = summary.lines!;
	}

	const doc = Document.create("CLI Complexity Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Complexity Report")
		.addBlank();

	// Coverage summary
	if (hasCoverage) {
		doc.callout("info", "Coverage", [
			`Statements: ${pct(summary.statements)} | Branches: ${pct(summary.branches)} | Functions: ${pct(summary.functions)} | Lines: ${pct(summary.lines)}`,
		]).addBlank();
	}

	// Decision points summary
	doc.callout("info", "Decision Points", [
		`Total: ${summary.totalDecisionPoints} across ${summary.filesWithDecisionPoints} files`,
	]).addBlank();

	// Top files by decision point count
	const topDP = [...srcFiles].sort((a, b) => b.decisionPointCount - a.decisionPointCount).slice(0, 15);
	if (topDP.length > 0) {
		doc.heading(2, "Top Files by Decision Points").addBlank();
		const headers = hasCoverage
			? ["#", "DPs", "Stmts", "Branch", "File"]
			: ["#", "DPs", "File"];
		const rows = topDP.map((f, i) => {
			const rel = `\`${relPath(f.file)}\``;
			return hasCoverage
				? [String(i + 1), String(f.decisionPointCount), pct(f.statements), pct(f.branches), rel]
				: [String(i + 1), String(f.decisionPointCount), rel];
		});
		doc.table(headers, rows, { alignRight: hasCoverage ? [0, 1, 2, 3] : [0, 1] }).addBlank();
	}

	// Decision point type breakdown
	const typeCounts = new Map<string, number>();
	for (const f of srcFiles) {
		for (const dp of f.decisionPoints ?? []) {
			typeCounts.set(dp.type, (typeCounts.get(dp.type) ?? 0) + 1);
		}
	}
	if (typeCounts.size > 0) {
		doc.heading(2, "Decision Point Types").addBlank();
		const sorted = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
		doc.table(
			["Type", "Count", "%"],
			sorted.map(([type, count]) => [
				`\`${type}\``,
				String(count),
				`${((count / summary.totalDecisionPoints) * 100).toFixed(1)}%`,
			]),
			{ alignRight: [1, 2] },
		).addBlank();
	}

	// Low coverage files
	if (hasCoverage) {
		const lowCov = [...srcFiles]
			.filter((f) => f.statements !== undefined && f.statements < 50)
			.sort((a, b) => (a.statements ?? 0) - (b.statements ?? 0))
			.slice(0, 10);
		if (lowCov.length > 0) {
			doc.heading(2, "Low Coverage Files (<50%)").addBlank();
			doc.table(
				["#", "Stmts", "Branch", "Funcs", "File"],
				lowCov.map((f, i) => [
					String(i + 1),
					pct(f.statements),
					pct(f.branches),
					pct(f.functions),
					`\`${relPath(f.file)}\``,
				]),
				{ alignRight: [0, 1, 2, 3] },
			).addBlank();
		}
	}

	// Save timestamped + stable copies
	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const outputPath = path.join(OUTPUT_DIR, `${safeTimestamp}-complexity-report.md`);
	doc.save(outputPath);
	doc.save(STABLE_PATH);

	console.log(`[cli-report] ComplexityReport written: ${outputPath}`);
}

main();
