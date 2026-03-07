/**
 * generate-complexity-report.ts — CLI project complexity report generator.
 *
 * Reads coverage/analysis.json (produced by `npm run analysis`) and generates
 * a markdown ComplexityReport with coverage, decision points, and top files.
 *
 * Usage: npm run analysis && tsx src/domain/reports/cli/generate-complexity-report.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";

const svc = new ReportService();
const ANALYSIS_JSON = svc.subdir("coverage/analysis.json");

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

function buildComplexityFm(summary: AnalysisSummary, srcFiles: AnalysisFile[]): Record<string, string | number> {
	const fm: Record<string, string | number> = {
		type: "ComplexityReport",
		project: "flowti-cli",
		date: new Date().toISOString(),
		total_files: srcFiles.length,
		total_decision_points: summary.totalDecisionPoints,
	};
	if (summary.statements !== undefined) {
		fm.statement_coverage = summary.statements;
		fm.branch_coverage = summary.branches!;
		fm.function_coverage = summary.functions!;
		fm.line_coverage = summary.lines!;
	}
	return fm;
}

function addTopDPSection(doc: Document, srcFiles: AnalysisFile[], hasCoverage: boolean): void {
	const topDP = [...srcFiles].sort((a, b) => b.decisionPointCount - a.decisionPointCount).slice(0, 15);
	if (topDP.length === 0) return;

	doc.heading(2, "Top Files by Decision Points").addBlank();
	const headers = hasCoverage ? ["#", "DPs", "Stmts", "Branch", "File"] : ["#", "DPs", "File"];
	const rows = topDP.map((f, i) => {
		const rel = `\`${relPath(f.file)}\``;
		return hasCoverage
			? [String(i + 1), String(f.decisionPointCount), pct(f.statements), pct(f.branches), rel]
			: [String(i + 1), String(f.decisionPointCount), rel];
	});
	doc.table(headers, rows, { alignRight: hasCoverage ? [0, 1, 2, 3] : [0, 1] }).addBlank();
}

function addDPTypeSection(doc: Document, srcFiles: AnalysisFile[], totalDP: number): void {
	const typeCounts = new Map<string, number>();
	for (const f of srcFiles) {
		for (const dp of f.decisionPoints ?? []) {
			typeCounts.set(dp.type, (typeCounts.get(dp.type) ?? 0) + 1);
		}
	}
	if (typeCounts.size === 0) return;

	doc.heading(2, "Decision Point Types").addBlank();
	const sorted = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
	doc.table(
		["Type", "Count", "%"],
		sorted.map(([type, count]) => [`\`${type}\``, String(count), `${((count / totalDP) * 100).toFixed(1)}%`]),
		{ alignRight: [1, 2] },
	).addBlank();
}

function addLowCoverageSection(doc: Document, srcFiles: AnalysisFile[]): void {
	const lowCov = [...srcFiles]
		.filter((f) => f.statements !== undefined && f.statements < 50)
		.sort((a, b) => (a.statements ?? 0) - (b.statements ?? 0))
		.slice(0, 10);
	if (lowCov.length === 0) return;

	doc.heading(2, "Low Coverage Files (<50%)").addBlank();
	doc.table(
		["#", "Stmts", "Branch", "Funcs", "File"],
		lowCov.map((f, i) => [String(i + 1), pct(f.statements), pct(f.branches), pct(f.functions), `\`${relPath(f.file)}\``]),
		{ alignRight: [0, 1, 2, 3] },
	).addBlank();
}

function main(): void {
	if (!disk.existsSync(ANALYSIS_JSON)) {
		log("[cli-report] No analysis.json found — run `npm run analysis` first.");
		return;
	}

	const data: AnalysisData = JSON.parse(disk.readFileSync(ANALYSIS_JSON, "utf-8"));
	const { summary, files } = data;
	const hasCoverage = summary.statements !== undefined;
	const srcFiles = files.filter((f) => !relPath(f.file).startsWith("bin/"));
	const fm = buildComplexityFm(summary, srcFiles);

	const doc = Document.create("CLI Complexity Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Complexity Report")
		.addBlank();

	if (hasCoverage) {
		doc.callout("info", "Coverage", [
			`Statements: ${pct(summary.statements)} | Branches: ${pct(summary.branches)} | Functions: ${pct(summary.functions)} | Lines: ${pct(summary.lines)}`,
		]).addBlank();
	}

	doc.callout("info", "Decision Points", [
		`Total: ${summary.totalDecisionPoints} across ${summary.filesWithDecisionPoints} files`,
	]).addBlank();

	addTopDPSection(doc, srcFiles, hasCoverage);
	addDPTypeSection(doc, srcFiles, summary.totalDecisionPoints);
	if (hasCoverage) addLowCoverageSection(doc, srcFiles);

	const outputPath = svc.save(doc, {
		subdir: "complexity",
		slug: "complexity-report",
		stableFilename: "Complexity Report.md",
		sourceJson: ANALYSIS_JSON,
	});

	log(`[cli-report] ComplexityReport written: ${outputPath}`);
}

main();
