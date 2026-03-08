/**
 * summary-loaders.ts — Data loading functions for the summary report.
 *
 * Reads JSON data sources (test results, coverage, complexity),
 * discovers markdown reports, and parses frontmatter.
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { shell } from "../../../infrastructure/shell.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type {
	ParsedFrontmatter,
	ReportSnapshot,
	TestJsonData,
	CoverageJsonSummary,
	JsonDataSources,
	IstanbulFileCoverage,
	FileCoverageStats,
	AnalysisFileEntry,
	ComplexityFunctionsData,
	DetailedSources,
	LintResult,
	LintIssue,
	ReportDef,
} from "./summary-types.js";

// ── Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: Required<SummaryThresholds> = {
	coverageLines: 80,
	coverageBranches: 70,
	maxComplexity: 15,
	complexityAboveThresholdPct: 5,
	startupMs: 5000,
	eslintWarnings: 0,
	lintCommand: "npm run lint",
};

export function resolveThresholds(projectPath: string): Required<SummaryThresholds> {
	const cfg = readProjectConfig(projectPath);
	const t = cfg?.reports?.thresholds ?? {};
	return { ...DEFAULT_THRESHOLDS, ...t };
}

// ── JSON data sources ────────────────────────────────────────────────

const TEST_JSON_DEFAULTS: TestJsonData = {
	numTotalTestSuites: 0, numPassedTestSuites: 0, numFailedTestSuites: 0,
	numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0,
	success: false,
};

export function readTestReportJson(reportsDir: string): TestJsonData | undefined {
	const jsonPath = paths.join(reportsDir, "tests", "testreport.json");
	if (!disk.existsSync(jsonPath)) return undefined;
	try {
		const raw = JSON.parse(disk.readFileSync(jsonPath, "utf-8"));
		return { ...TEST_JSON_DEFAULTS, ...raw };
	} catch {
		return undefined;
	}
}

export function aggregateCoverageJson(reportsDir: string): CoverageJsonSummary | undefined {
	const jsonPath = paths.join(reportsDir, "coverage", "coverage-final.json");
	if (!disk.existsSync(jsonPath)) return undefined;
	try {
		const raw: Record<string, IstanbulFileCoverage> = JSON.parse(disk.readFileSync(jsonPath, "utf-8"));
		const files = Object.values(raw);
		if (files.length === 0) return undefined;

		let statementsTotal = 0, statementsCovered = 0;
		let branchesTotal = 0, branchesCovered = 0;
		let functionsTotal = 0, functionsCovered = 0;

		for (const file of files) {
			const stmtCounts = Object.values(file.s);
			statementsTotal += stmtCounts.length;
			statementsCovered += stmtCounts.filter((c) => c > 0).length;

			for (const branchCounts of Object.values(file.b)) {
				branchesTotal += branchCounts.length;
				branchesCovered += branchCounts.filter((c) => c > 0).length;
			}

			const fnCounts = Object.values(file.f);
			functionsTotal += fnCounts.length;
			functionsCovered += fnCounts.filter((c) => c > 0).length;
		}

		const pct = (covered: number, total: number) =>
			total > 0 ? Math.round((covered / total) * 10000) / 100 : 0;

		return {
			linesPct: pct(statementsCovered, statementsTotal),
			branchesPct: pct(branchesCovered, branchesTotal),
			functionsPct: pct(functionsCovered, functionsTotal),
			statementsPct: pct(statementsCovered, statementsTotal),
			filesCovered: files.length,
		};
	} catch {
		return undefined;
	}
}

// ── Per-file coverage ────────────────────────────────────────────────

export function countLoc(absPath: string): number {
	try {
		const content = disk.readFileSync(absPath, "utf-8");
		return content.split("\n").filter((l) => l.trim().length > 0).length;
	} catch {
		return 0;
	}
}

export function computePerFileCoverage(reportsDir: string, projectPath: string): FileCoverageStats[] {
	const jsonPath = paths.join(reportsDir, "coverage", "coverage-final.json");
	if (!disk.existsSync(jsonPath)) return [];
	try {
		const raw: Record<string, IstanbulFileCoverage> = JSON.parse(disk.readFileSync(jsonPath, "utf-8"));
		const stats: FileCoverageStats[] = [];
		for (const [filePath, data] of Object.entries(raw)) {
			const stmts = Object.values(data.s);
			const stmtTotal = stmts.length;
			const stmtCovered = stmts.filter((c) => c > 0).length;
			const fns = Object.values(data.f);
			const fnTotal = fns.length;
			const fnUncovered = fns.filter((c) => c === 0).length;
			const rel = filePath.replace(/.*Flowti CLI[\\/]/, "").replace(/\\/g, "/");
			if (!rel.startsWith("src/")) continue;
			const absFile = paths.join(projectPath, rel.replace(/\//g, paths.sep));
			stats.push({
				file: rel,
				loc: countLoc(absFile),
				stmtTotal,
				stmtCovered,
				stmtPct: stmtTotal > 0 ? Math.round((stmtCovered / stmtTotal) * 1000) / 10 : 0,
				fnTotal,
				fnUncovered,
			});
		}
		return stats;
	} catch {
		return [];
	}
}

// ── Complexity data ──────────────────────────────────────────────────

export function loadAnalysisTopFiles(reportsDir: string, limit: number): AnalysisFileEntry[] {
	const jsonPath = paths.join(reportsDir, "coverage", "analysis.json");
	if (!disk.existsSync(jsonPath)) return [];
	try {
		const raw = JSON.parse(disk.readFileSync(jsonPath, "utf-8"));
		const files: AnalysisFileEntry[] = (raw.files ?? [])
			.filter((f: AnalysisFileEntry) => f.decisionPointCount > 0)
			.map((f: AnalysisFileEntry) => ({
				file: f.file.replace(/.*Flowti CLI[\\/]/, "").replace(/\\/g, "/"),
				decisionPointCount: f.decisionPointCount,
			}))
			.filter((f: AnalysisFileEntry) => f.file.startsWith("src/"));
		return files.sort((a, b) => b.decisionPointCount - a.decisionPointCount).slice(0, limit);
	} catch {
		return [];
	}
}

export function loadComplexityFunctions(reportsDir: string): ComplexityFunctionsData | undefined {
	const jsonPath = paths.join(reportsDir, "coverage", "complexity-functions.json");
	if (!disk.existsSync(jsonPath)) return undefined;
	try {
		return JSON.parse(disk.readFileSync(jsonPath, "utf-8")) as ComplexityFunctionsData;
	} catch {
		return undefined;
	}
}

export function loadDetailedSources(reportsDir: string, projectPath: string): DetailedSources {
	return {
		perFile: computePerFileCoverage(reportsDir, projectPath),
		topComplexFiles: loadAnalysisTopFiles(reportsDir, 10),
		complexityFunctions: loadComplexityFunctions(reportsDir),
	};
}

export function loadJsonDataSources(reportsDir: string): JsonDataSources {
	return {
		tests: readTestReportJson(reportsDir),
		coverage: aggregateCoverageJson(reportsDir),
	};
}

// ── Frontmatter parser ───────────────────────────────────────────────

export function parseFrontmatter(content: string): ParsedFrontmatter {
	const lines = content.split("\n");
	const fm: ParsedFrontmatter = {};
	if (lines[0]?.trim() !== "---") return fm;

	const endIdx = lines.indexOf("---", 1);
	if (endIdx <= 0) return fm;

	for (let i = 1; i < endIdx; i++) {
		const match = lines[i].match(/^(\w[\w_]*)\s*:\s*(.*)$/);
		if (match) fm[match[1]] = match[2].replace(/^["']|["']$/g, "");
	}
	return fm;
}

// ── Report discovery ─────────────────────────────────────────────────

export const REPORT_DEFS: ReportDef[] = [
	{ subdir: "tests", label: "Tests" },
	{ subdir: "coverage", label: "Coverage" },
	{ subdir: "builds", label: "Build" },
	{ subdir: "codebase", label: "Codebase" },
	{ subdir: "complexity", label: "Complexity", stableName: "Complexity Report.md" },
	{ subdir: "cycles", label: "Cycle" },
	{ subdir: "performance", label: "Performance" },
	{ subdir: "traceability", label: "Traceability", stableName: "Trace Conformance Report.md" },
	{ subdir: "e2e", label: "E2E Tests", stableName: "E2E Report.md" },
];

export function findLatestMd(dir: string): string | null {
	if (!disk.existsSync(dir)) return null;
	const files = disk.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && /^\d{4}-/.test(f))
		.sort();
	return files.length > 0 ? paths.join(dir, files[files.length - 1]) : null;
}

export function discoverReports(reportsDir: string): ReportSnapshot[] {
	const snapshots: ReportSnapshot[] = [];

	for (const def of REPORT_DEFS) {
		const subdir = paths.join(reportsDir, def.subdir);

		if (def.stableName) {
			const stablePath = paths.join(subdir, def.stableName);
			if (disk.existsSync(stablePath)) {
				const content = disk.readFileSync(stablePath, "utf-8");
				snapshots.push({ label: def.label, file: `${def.subdir}/${def.stableName}`, frontmatter: parseFrontmatter(content) });
				continue;
			}
		}

		const latest = findLatestMd(subdir);
		if (latest) {
			const content = disk.readFileSync(latest, "utf-8");
			const relFile = `${def.subdir}/${paths.basename(latest)}`;
			snapshots.push({ label: def.label, file: relFile, frontmatter: parseFrontmatter(content) });
		}
	}

	return snapshots;
}

// ── Eslint collection ────────────────────────────────────────────────

export function collectLintWarnings(projectPath: string, command: string): LintResult {
	const output = shell.runSilent(command, { cwd: projectPath });
	return parseLintOutput(output ?? "", projectPath);
}

export function parseLintOutput(output: string, projectRoot = ""): LintResult {
	const summaryMatch = output.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/);
	const errors = summaryMatch ? parseInt(summaryMatch[2], 10) : (output.match(/\berror\b/gi) ?? []).length;
	const warnings = summaryMatch ? parseInt(summaryMatch[3], 10) : (output.match(/\bwarning\b/gi) ?? []).length;

	const ruleCounts: Record<string, number> = {};
	const issues: LintIssue[] = [];
	const lines = output.split("\n");
	let currentFile = "";

	for (const line of lines) {
		if (/^[A-Z]:\\/.test(line) || line.startsWith("/")) {
			currentFile = projectRoot
				? line.replace(projectRoot.replace(/\\/g, "\\"), "").replace(/^[\\/]/, "")
				: line;
			currentFile = currentFile.replace(/\\/g, "/");
			continue;
		}

		const issueMatch = line.match(/^\s+(\d+):(\d+)\s+(warning|error)\s+(.+?)\s{2,}(\S+)\s*$/);
		if (issueMatch) {
			const rule = issueMatch[5];
			const severity = issueMatch[3] as "warning" | "error";
			ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;
			issues.push({
				file: currentFile,
				line: parseInt(issueMatch[1], 10),
				col: parseInt(issueMatch[2], 10),
				severity,
				message: issueMatch[4].trim(),
				rule,
			});
		}
	}

	const breakdown = Object.entries(ruleCounts)
		.map(([rule, count]) => ({ rule, count }))
		.sort((a, b) => b.count - a.count);

	return { errors, warnings, breakdown, issues };
}
