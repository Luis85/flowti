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

import { paths } from "../../../infrastructure/paths.js";
import { proc } from "../../../infrastructure/proc.js";
import { shell } from "../../../infrastructure/shell.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { ReportService } from "./report-service.js";
import { log, error } from "../../../infrastructure/logger.js";
import { analyzeComplexity } from "./complexity-analyzer.js";
import type { AnalysisResult } from "./complexity-analyzer.js";

const svc = new ReportService();

// ── Configurable paths ──────────────────────────────────────────────
const VITEST_CONFIG = paths.join(CLI_PROJECT, "configs", "vitest.config.ts");
const COVERAGE_DIR = svc.coverageDir;
// ─────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = paths.join(CLI_PROJECT, COVERAGE_DIR);

/** Default timeout for shell commands (2 minutes). */
const CMD_TIMEOUT = 120_000;

function run(cmd: string): void {
	log(`\n> ${cmd}\n`);
	const { exitCode } = shell.runCaptureStatus(cmd, { cwd: CLI_PROJECT, timeout: CMD_TIMEOUT });
	if (exitCode !== 0) {
		log(`Command exited with code ${exitCode}: ${cmd}`);
	}
}

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

function convertCoverageToJson(coverageFinalPath: string): CoverageSummaryOutput {
	const raw: Record<string, IstanbulEntry> = JSON.parse(disk.readFileSync(coverageFinalPath, "utf-8"));
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

		const rel = paths.relative(CLI_PROJECT, filePath).replace(/\\/g, "/");
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

function mergeAnalysis(
	coverage: CoverageSummaryOutput | null,
	complexity: AnalysisResult,
): Record<string, unknown> {
	const dpByFile = new Map(complexity.files.map((f) => [f.file, f]));
	const covByFile = new Map(coverage?.files.map((f) => [f.file, f]) ?? []);
	const allFiles = new Set([...dpByFile.keys(), ...covByFile.keys()]);

	const files = [...allFiles].sort().map((file) => {
		const cov = covByFile.get(file);
		const dp = dpByFile.get(file);
		const uncoveredSet = new Set(cov?.uncoveredLines ?? []);
		const uncoveredDecisionPoints = (dp?.decisionPoints ?? []).filter((p) => uncoveredSet.has(p.line));

		return {
			file,
			...(cov ? { statements: cov.statements, branches: cov.branches, functions: cov.functions, lines: cov.lines, uncoveredLineRanges: cov.uncoveredLineRanges } : {}),
			decisionPointCount: dp?.decisionPointCount ?? 0,
			decisionPoints: dp?.decisionPoints ?? [],
			decisionPointLines: dp?.decisionPointLines ?? [],
			decisionPointLineRanges: dp?.decisionPointLineRanges ?? [],
			uncoveredDecisionPoints,
		};
	});

	return {
		summary: {
			...(coverage?.summary ?? {}),
			totalDecisionPoints: complexity.files.reduce((sum, f) => sum + f.decisionPointCount, 0),
			filesWithDecisionPoints: complexity.files.filter((f) => f.decisionPointCount > 0).length,
		},
		files,
	};
}

// ── Write complexity outputs ────────────────────────────────────────

function writeComplexityOutputs(result: AnalysisResult): void {
	disk.mkdirSync(OUTPUT_DIR, { recursive: true });

	// complexity-functions.json
	const functionsOutput = { summary: result.summary, functions: result.functions };
	const functionsPath = paths.join(OUTPUT_DIR, "complexity-functions.json");
	disk.writeFileSync(functionsPath, JSON.stringify(functionsOutput, null, 2), "utf-8");
	log(`Wrote ${functionsPath}`);

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
	const dpPath = paths.join(OUTPUT_DIR, "decision-points-summary.json");
	disk.writeFileSync(dpPath, JSON.stringify(dpOutput, null, 2), "utf-8");
	log(`Wrote ${dpPath}`);
}

// ── Main pipeline ───────────────────────────────────────────────────

function main(): void {
	const coverageFinalPath = paths.join(OUTPUT_DIR, "coverage-final.json");
	const srcDir = paths.join(CLI_PROJECT, "src");

	// 1. Run vitest only if coverage-final.json doesn't exist yet
	if (!disk.existsSync(coverageFinalPath)) {
		run(`npx vitest run --config "${VITEST_CONFIG}" --coverage --coverage.reportsDirectory=${COVERAGE_DIR} --coverage.reporter=json`);
	} else {
		log("Skipping vitest — coverage-final.json already exists.");
	}

	// 2. Convert coverage-final.json → coverage-summary.json
	let coverage: CoverageSummaryOutput | null = null;
	if (disk.existsSync(coverageFinalPath)) {
		log("Converting coverage data...");
		coverage = convertCoverageToJson(coverageFinalPath);
		const coverageSummaryPath = paths.join(OUTPUT_DIR, "coverage-summary.json");
		disk.mkdirSync(OUTPUT_DIR, { recursive: true });
		disk.writeFileSync(coverageSummaryPath, JSON.stringify(coverage, null, 2), "utf-8");
		log(`Wrote ${coverageSummaryPath}`);
	}

	// 3. Run complexity analysis (single-pass TypeScript AST)
	log(`\nAnalyzing complexity in ${srcDir}...`);
	const startMs = Date.now();
	const complexityResult = analyzeComplexity(srcDir, CLI_PROJECT);
	const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
	log(`Complexity analysis: ${complexityResult.summary.totalFunctions} functions, ${complexityResult.files.length} files (${durationSec}s)`);
	writeComplexityOutputs(complexityResult);

	// 4. Merge coverage + complexity → analysis.json
	const merged = mergeAnalysis(coverage, complexityResult);
	const analysisPath = paths.join(OUTPUT_DIR, "analysis.json");
	disk.writeFileSync(analysisPath, JSON.stringify(merged, null, 2), "utf-8");
	log(`Wrote ${analysisPath}`);

	log(`\nAnalysis complete. Output: ${COVERAGE_DIR}/analysis.json`);
}

main();
