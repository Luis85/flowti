/**
 * run-analysis.ts — Runs the complexity-analysis pipeline.
 *
 * Uses the built-in TypeScript AST analyzer (complexity-analyzer.ts)
 * instead of ESLint for complexity analysis. Single-pass, no external deps.
 *
 * Output (<reportsDir>/coverage/):
 *   1. vitest run --coverage       → coverage-final.json
 *   2. coverage-to-json (inline)   → coverage-summary.json
 *   3. complexity analyzer         → complexity-functions.json + decision-points-summary.json
 *   4. merge (inline)              → analysis.json
 */

import { CLI_PROJECT } from "../infrastructure/config.js";
import { ReportService } from "../domain/reports/cli/report-service.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { analyzeComplexity } from "../domain/reports/cli/complexity-analyzer.js";
import type { AnalysisResult } from "../domain/reports/cli/complexity-analyzer.js";
import type { IShell } from "../infrastructure/types.js";

/** Dependencies required by the analysis pipeline. */
export type AnalysisDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "log"> & { shell: Pick<IShell, "runCaptureStatus"> };

// ── Coverage JSON conversion (inlined from library tool) ────────────

interface IstanbulEntry {
	s: Record<string, number>;
	b: Record<string, number[]>;
	f: Record<string, number>;
	statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
}

function toPct(covered: number, total: number): number {
	if (total === 0) return 100;
	return Math.round((covered / total) * 10000) / 100;
}

function uncoveredLines(entry: IstanbulEntry): number[] {
	const lines = new Set<number>();
	for (const [id, count] of Object.entries(entry.s)) {
		if (count === 0 && entry.statementMap[id]) {
			const { start, end } = entry.statementMap[id];
			for (let line = start.line; line <= end.line; line++) lines.add(line);
		}
	}
	return [...lines].sort((a, b) => a - b);
}

function toRangeStrings(lineNumbers: number[]): string[] {
	if (lineNumbers.length === 0) return [];
	const ranges: string[] = [];
	let start = lineNumbers[0], end = lineNumbers[0];
	for (let i = 1; i < lineNumbers.length; i++) {
		if (lineNumbers[i] === end + 1) { end = lineNumbers[i]; }
		else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = lineNumbers[i]; end = lineNumbers[i]; }
	}
	ranges.push(start === end ? `${start}` : `${start}-${end}`);
	return ranges;
}

interface CoverageSummaryFile {
	file: string;
	statements: number;
	branches: number;
	functions: number;
	lines: number;
	uncoveredLines: number[];
	uncoveredLineRanges: string[];
}

interface CoverageSummaryOutput {
	summary: { statements: number; branches: number; functions: number; lines: number };
	files: CoverageSummaryFile[];
}

function convertCoverageToJson(coverageFinalPath: string, deps: Pick<AnalysisDeps, "disk" | "paths">): CoverageSummaryOutput {
	const raw: Record<string, IstanbulEntry> = JSON.parse(deps.disk.readFileSync(coverageFinalPath, "utf-8"));
	const files: CoverageSummaryFile[] = [];
	let stTotal = 0, stCovered = 0, brTotal = 0, brCovered = 0, fnTotal = 0, fnCovered = 0, lnTotal = 0, lnCovered = 0;

	for (const [filePath, entry] of Object.entries(raw)) {
		const sIds = Object.keys(entry.s);
		const sT = sIds.length;
		const sC = sIds.filter((id) => entry.s[id] > 0).length;

		let bT = 0, bC = 0;
		for (const hits of Object.values(entry.b)) {
			bT += hits.length;
			bC += hits.filter((h) => h > 0).length;
		}

		const fIds = Object.keys(entry.f);
		const fT = fIds.length;
		const fC = fIds.filter((id) => entry.f[id] > 0).length;

		const lineSet = new Set<number>();
		const coveredSet = new Set<number>();
		for (const [id, range] of Object.entries(entry.statementMap)) {
			for (let line = range.start.line; line <= range.end.line; line++) {
				lineSet.add(line);
				if (entry.s[id] > 0) coveredSet.add(line);
			}
		}
		const lT = lineSet.size;
		const lC = [...lineSet].filter((l) => coveredSet.has(l)).length;

		stTotal += sT; stCovered += sC;
		brTotal += bT; brCovered += bC;
		fnTotal += fT; fnCovered += fC;
		lnTotal += lT; lnCovered += lC;

		const rel = deps.paths.relative(CLI_PROJECT, filePath).replace(/\\/g, "/");
		const uncov = uncoveredLines(entry);
		files.push({
			file: rel,
			statements: toPct(sC, sT),
			branches: toPct(bC, bT),
			functions: toPct(fC, fT),
			lines: toPct(lC, lT),
			uncoveredLines: uncov,
			uncoveredLineRanges: toRangeStrings(uncov),
		});
	}

	return {
		summary: { statements: toPct(stCovered, stTotal), branches: toPct(brCovered, brTotal), functions: toPct(fnCovered, fnTotal), lines: toPct(lnCovered, lnTotal) },
		files: files.sort((a, b) => a.file.localeCompare(b.file)),
	};
}

// ── Merge coverage + complexity → analysis.json ─────────────────────

function coverageFields(cov: CoverageSummaryFile): Record<string, unknown> {
	return {
		statements: cov.statements,
		branches: cov.branches,
		functions: cov.functions,
		lines: cov.lines,
		uncoveredLineRanges: cov.uncoveredLineRanges,
	};
}

const EMPTY_DP = { decisionPointCount: 0, decisionPoints: [] as import("../domain/reports/cli/complexity-analyzer.js").DecisionPoint[], decisionPointLines: [] as number[], decisionPointLineRanges: [] as string[] };

function complexityFields(dp: import("../domain/reports/cli/complexity-analyzer.js").FileAnalysis | undefined, uncoveredLines: Set<number>): Record<string, unknown> {
	const d = dp ?? EMPTY_DP;
	return {
		decisionPointCount: d.decisionPointCount,
		decisionPoints: d.decisionPoints,
		decisionPointLines: d.decisionPointLines,
		decisionPointLineRanges: d.decisionPointLineRanges,
		uncoveredDecisionPoints: d.decisionPoints.filter((p) => uncoveredLines.has(p.line)),
	};
}

function mergeFileEntry(
	file: string,
	cov: CoverageSummaryFile | undefined,
	dp: import("../domain/reports/cli/complexity-analyzer.js").FileAnalysis | undefined,
): Record<string, unknown> {
	const uncoveredSet = new Set(cov?.uncoveredLines ?? []);
	return {
		file,
		...(cov ? coverageFields(cov) : {}),
		...complexityFields(dp, uncoveredSet),
	};
}

function mergeAnalysis(
	coverage: CoverageSummaryOutput | null,
	complexity: AnalysisResult,
): Record<string, unknown> {
	const dpByFile = new Map(complexity.files.map((f) => [f.file, f]));
	const covByFile = new Map(coverage?.files.map((f) => [f.file, f]) ?? []);
	const allFiles = [...new Set([...dpByFile.keys(), ...covByFile.keys()])].sort();

	return {
		summary: {
			...(coverage?.summary ?? {}),
			totalDecisionPoints: complexity.files.reduce((sum, f) => sum + f.decisionPointCount, 0),
			filesWithDecisionPoints: complexity.files.filter((f) => f.decisionPointCount > 0).length,
		},
		files: allFiles.map((file) => mergeFileEntry(file, covByFile.get(file), dpByFile.get(file))),
	};
}

// ── Write complexity outputs ────────────────────────────────────────

function writeComplexityOutputs(result: AnalysisResult, outputDir: string, deps: Pick<AnalysisDeps, "disk" | "paths" | "log">): void {
	deps.disk.mkdirSync(outputDir, { recursive: true });

	// complexity-functions.json
	const functionsOutput = { summary: result.summary, functions: result.functions };
	const functionsPath = deps.paths.join(outputDir, "complexity-functions.json");
	deps.disk.writeFileSync(functionsPath, JSON.stringify(functionsOutput, null, 2), "utf-8");
	deps.log(`Wrote ${functionsPath}`);

	// decision-points-summary.json
	const dpOutput = {
		summary: {
			totalDecisionPoints: result.files.reduce((sum, f) => sum + f.decisionPointCount, 0),
			filesWithDecisionPoints: result.files.filter((f) => f.decisionPointCount > 0).length,
		},
		files: result.files.map((f) => ({
			file: f.file,
			decisionPointCount: f.decisionPointCount,
			decisionPoints: f.decisionPoints,
			decisionPointLines: f.decisionPointLines,
			decisionPointLineRanges: f.decisionPointLineRanges,
		})),
	};
	const dpPath = deps.paths.join(outputDir, "decision-points-summary.json");
	deps.disk.writeFileSync(dpPath, JSON.stringify(dpOutput, null, 2), "utf-8");
	deps.log(`Wrote ${dpPath}`);
}

// ── Exported pipeline ────────────────────────────────────────────────

export function runAnalysisPipeline(deps: AnalysisDeps): void {
	const { disk, paths: p, log: logFn, shell: sh } = deps;

	const svc = new ReportService(CLI_PROJECT, deps);
	const VITEST_CONFIG = p.join(CLI_PROJECT, "configs", "vitest.config.ts");
	const COVERAGE_DIR = svc.coverageDir;
	const OUTPUT_DIR = p.join(CLI_PROJECT, COVERAGE_DIR);
	const CMD_TIMEOUT = 120_000;

	function run(cmd: string): void {
		logFn(`\n> ${cmd}\n`);
		const { exitCode } = sh.runCaptureStatus(cmd, { cwd: CLI_PROJECT, timeout: CMD_TIMEOUT });
		if (exitCode !== 0) {
			logFn(`Command exited with code ${exitCode}: ${cmd}`);
		}
	}

	const coverageFinalPath = p.join(OUTPUT_DIR, "coverage-final.json");
	const srcDir = p.join(CLI_PROJECT, "src");

	// 1. Run vitest only if coverage-final.json doesn't exist yet
	if (!disk.existsSync(coverageFinalPath)) {
		run(`npx vitest run --config "${VITEST_CONFIG}" --coverage --coverage.reportsDirectory=${COVERAGE_DIR} --coverage.reporter=json`);
	} else {
		logFn("Skipping vitest — coverage-final.json already exists.");
	}

	// 2. Convert coverage-final.json → coverage-summary.json
	let coverage: CoverageSummaryOutput | null = null;
	if (disk.existsSync(coverageFinalPath)) {
		logFn("Converting coverage data...");
		coverage = convertCoverageToJson(coverageFinalPath, deps);
		const coverageSummaryPath = p.join(OUTPUT_DIR, "coverage-summary.json");
		disk.mkdirSync(OUTPUT_DIR, { recursive: true });
		disk.writeFileSync(coverageSummaryPath, JSON.stringify(coverage, null, 2), "utf-8");
		logFn(`Wrote ${coverageSummaryPath}`);
	}

	// 3. Run complexity analysis (single-pass TypeScript AST)
	logFn(`\nAnalyzing complexity in ${srcDir}...`);
	const startMs = Date.now();
	const complexityResult = analyzeComplexity(srcDir, CLI_PROJECT);
	const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
	logFn(`Complexity analysis: ${complexityResult.summary.totalFunctions} functions, ${complexityResult.files.length} files (${durationSec}s)`);
	writeComplexityOutputs(complexityResult, OUTPUT_DIR, deps);

	// 4. Merge coverage + complexity → analysis.json
	const merged = mergeAnalysis(coverage, complexityResult);
	const analysisPath = p.join(OUTPUT_DIR, "analysis.json");
	disk.writeFileSync(analysisPath, JSON.stringify(merged, null, 2), "utf-8");
	logFn(`Wrote ${analysisPath}`);

	logFn(`\nAnalysis complete. Output: ${COVERAGE_DIR}/analysis.json`);
}
