/**
 * run-analysis.ts — Runs the complexity-analysis pipeline with the project's
 * vitest config. Produces JSON data only (no HTML, no stale artifacts).
 *
 * Replaces the library's `runESLintComplexityCheck` to avoid the hardcoded
 * `complexity/complexity-report.json` side effect. All other library functions
 * (extraction, parsing, merging) are used as-is.
 *
 * Output (<reportsDir>/coverage/):
 *   1. vitest run --coverage       → coverage-final.json
 *   2. coverage-to-json            → coverage-summary.json
 *   3. decision-points analysis    → decision-points-summary.json
 *   4. merge                       → analysis.json
 */

import { paths } from "../../../infrastructure/paths.js";
import { proc } from "../../../infrastructure/proc.js";
import { shell } from "../../../infrastructure/shell.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { ESLint } from "eslint";

// Library imports — downstream functions only (no runESLintComplexityCheck)
import { getComplexityVariant } from "@pythonidaer/complexity-report/integration/eslint/index.js";
import { extractFunctionsFromESLintResults } from "@pythonidaer/complexity-report/function-extraction/index.js";
import { findFunctionBoundaries } from "@pythonidaer/complexity-report/function-boundaries/index.js";
import { parseDecisionPointsAST } from "@pythonidaer/complexity-report/decision-points/index.js";

import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { ReportService } from "./report-service.js";
import { log, error } from "../../../infrastructure/logger.js";

const svc = new ReportService();
const LIB_TOOLS = paths.join(CLI_PROJECT, "node_modules", "@pythonidaer", "complexity-report", "tools");

// ── Configurable paths ──────────────────────────────────────────────
const VITEST_CONFIG = paths.join(CLI_PROJECT, "configs", "vitest.config.ts");
const ESLINT_CONFIG = paths.join(CLI_PROJECT, "configs", "eslint.config.mjs");
const COVERAGE_DIR = svc.coverageDir;
// ─────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = paths.join(CLI_PROJECT, COVERAGE_DIR);

function run(cmd: string): void {
	log(`\n> ${cmd}\n`);
	shell.run(cmd, { cwd: CLI_PROJECT });
}

function tool(script: string, ...args: string[]): string {
	return `node "${paths.join(LIB_TOOLS, script)}" ${args.join(" ")}`;
}

// ── ESLint complexity check (no file write) ─────────────────────────

async function runESLintComplexity(): Promise<ESLint.LintResult[]> {
	const variant = getComplexityVariant(ESLINT_CONFIG);
	log("Running ESLint to collect complexity for all functions...");

	const eslint = new ESLint({
		cwd: CLI_PROJECT,
		overrideConfigFile: ESLINT_CONFIG,
		ignorePatterns: [
			"**/__tests__/**", "**/*.test.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}",
			"complexity/**", "dist/**", "build/**", "node_modules/**", "**/coverage/**",
		],
		overrideConfig: { rules: { complexity: ["warn", { max: 0, variant }] } },
	});

	return eslint.lintFiles(["."]);
}

// ── Decision points (inline, no side-effect file) ───────────────────

function toRanges(lines: number[]): string[] {
	if (lines.length === 0) return [];
	const ranges: string[] = [];
	let start = lines[0], end = lines[0];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === end + 1) { end = lines[i]; }
		else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = lines[i]; end = lines[i]; }
	}
	ranges.push(start === end ? `${start}` : `${start}-${end}`);
	return ranges;
}

interface FuncEntry { file: string; complexity?: string; functionName?: string; line?: number; [key: string]: unknown }

interface ComplexityFunctionEntry {
	file: string;
	functionName: string;
	line: number;
	complexity: number;
}

function writeComplexityFunctions(allFunctions: FuncEntry[]): void {
	const entries: ComplexityFunctionEntry[] = allFunctions
		.filter((f) => f.complexity !== undefined)
		.map((f) => ({
			file: String(f.file),
			functionName: String(f.functionName ?? "unknown"),
			line: Number(f.line ?? 0),
			complexity: parseInt(String(f.complexity), 10),
		}))
		.sort((a, b) => b.complexity - a.complexity);

	const maxComplexity = entries.length > 0 ? entries[0].complexity : 0;
	const totalComplexity = entries.reduce((sum, e) => sum + e.complexity, 0);
	const avgComplexity = entries.length > 0 ? Math.round((totalComplexity / entries.length) * 10) / 10 : 0;
	const sorted = entries.map((e) => e.complexity).sort((a, b) => a - b);
	const medianComplexity = entries.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

	const output = {
		summary: {
			totalFunctions: entries.length,
			maxComplexity,
			avgComplexity,
			medianComplexity,
			totalComplexity,
			aboveThreshold10: entries.filter((e) => e.complexity > 10).length,
			aboveThreshold15: entries.filter((e) => e.complexity > 15).length,
		},
		functions: entries,
	};

	const outputPath = paths.join(OUTPUT_DIR, "complexity-functions.json");
	disk.mkdirSync(OUTPUT_DIR, { recursive: true });
	disk.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
	log("Wrote", outputPath);
}

async function generateDecisionPoints(eslintResults: ESLint.LintResult[]): Promise<void> {
	const variant = getComplexityVariant(ESLINT_CONFIG);

	const allFunctions: FuncEntry[] = extractFunctionsFromESLintResults(eslintResults, CLI_PROJECT);
	writeComplexityFunctions(allFunctions);
	const fileMap = new Map<string, FuncEntry[]>();
	for (const func of allFunctions) {
		if (!fileMap.has(func.file)) fileMap.set(func.file, []);
		fileMap.get(func.file)!.push(func);
	}

	const parseDPs = (source: string, boundaries: unknown, funcs: FuncEntry[], filePath: string) =>
		parseDecisionPointsAST(source, boundaries, funcs, filePath, CLI_PROJECT, { variant });

	const files: Array<{ file: string; decisionPointCount: number; decisionPoints: Array<{ line: number; type: string; functionLine: number }>; decisionPointLines: number[]; decisionPointLineRanges: string[] }> = [];
	let totalDecisionPoints = 0;

	for (const [filePath, funcs] of fileMap.entries()) {
		const fullPath = paths.resolve(CLI_PROJECT, filePath);
		if (!disk.existsSync(fullPath)) continue;
		let decisionPoints: Array<{ line: number; type: string; functionLine: number }>;
		try {
			const source = disk.readFileSync(fullPath, "utf-8");
			const boundaries = findFunctionBoundaries(source, funcs);
			decisionPoints = await parseDPs(source, boundaries, funcs, filePath);
		} catch {
			decisionPoints = [];
		}

		const points = decisionPoints.map((dp) => ({ line: dp.line, type: dp.type, functionLine: dp.functionLine }));
		const dpLines = [...new Set(decisionPoints.map((dp) => dp.line))].sort((a, b) => a - b);

		totalDecisionPoints += decisionPoints.length;
		files.push({
			file: filePath,
			decisionPointCount: decisionPoints.length,
			decisionPoints: points,
			decisionPointLines: dpLines,
			decisionPointLineRanges: toRanges(dpLines),
		});
	}

	const output = {
		summary: { totalDecisionPoints, filesWithDecisionPoints: files.filter((f) => f.decisionPointCount > 0).length },
		files: files.sort((a, b) => a.file.localeCompare(b.file)),
	};

	const outputPath = paths.join(OUTPUT_DIR, "decision-points-summary.json");
	disk.mkdirSync(OUTPUT_DIR, { recursive: true });
	disk.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
	log("Wrote", outputPath);
}

// ── Main pipeline ───────────────────────────────────────────────────

async function main(): Promise<void> {
	const coverageFinal = paths.join(OUTPUT_DIR, "coverage-final.json");

	// 1. Run vitest only if coverage-final.json doesn't exist yet
	//    (test:coverage already produces it when run via the reports pipeline)
	if (!disk.existsSync(coverageFinal)) {
		run(`npx vitest run --config "${VITEST_CONFIG}" --coverage --coverage.reportsDirectory=${COVERAGE_DIR} --coverage.reporter=json`);
	} else {
		log("Skipping vitest — coverage-final.json already exists.");
	}

	// 2. Convert coverage-final.json → coverage-summary.json
	run(tool("coverage-to-json.js", `${COVERAGE_DIR}/coverage-final.json`, `${COVERAGE_DIR}/coverage-summary.json`));

	// 3. Run ESLint decision-points analysis (no complexity/ artifact)
	const eslintResults = await runESLintComplexity();
	await generateDecisionPoints(eslintResults);

	// 4. Merge coverage + decision points → analysis.json
	run(tool("merge-coverage-decision-points.js", COVERAGE_DIR));

	log(`\nAnalysis complete. Output: ${COVERAGE_DIR}/analysis.json`);
}

main().catch((err) => { error(err); proc.exit(1); });
