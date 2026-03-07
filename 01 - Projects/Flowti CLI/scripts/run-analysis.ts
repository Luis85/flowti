/**
 * run-analysis.ts — Runs the complexity-analysis pipeline with the project's
 * vitest config. Produces JSON data only (no HTML, no stale artifacts).
 *
 * Replaces the library's `runESLintComplexityCheck` to avoid the hardcoded
 * `complexity/complexity-report.json` side effect. All other library functions
 * (extraction, parsing, merging) are used as-is.
 *
 * Output (docs/reports/coverage/):
 *   1. vitest run --coverage       → coverage-final.json
 *   2. coverage-to-json            → coverage-summary.json
 *   3. decision-points analysis    → decision-points-summary.json
 *   4. merge                       → analysis.json
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

// Library imports — downstream functions only (no runESLintComplexityCheck)
import { getComplexityVariant } from "@pythonidaer/complexity-report/integration/eslint/index.js";
import { extractFunctionsFromESLintResults } from "@pythonidaer/complexity-report/function-extraction/index.js";
import { findFunctionBoundaries } from "@pythonidaer/complexity-report/function-boundaries/index.js";
import { parseDecisionPointsAST } from "@pythonidaer/complexity-report/decision-points/index.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const LIB_TOOLS = path.join(PROJECT_ROOT, "node_modules", "@pythonidaer", "complexity-report", "tools");

// ── Configurable paths ──────────────────────────────────────────────
const VITEST_CONFIG = path.join(PROJECT_ROOT, "configs", "vitest.config.ts");
const ESLINT_CONFIG = path.join(PROJECT_ROOT, "configs", "eslint.config.mjs");
const COVERAGE_DIR = "docs/reports/coverage";
// ─────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(PROJECT_ROOT, COVERAGE_DIR);

function run(cmd: string): void {
	console.log(`\n> ${cmd}\n`);
	execSync(cmd, { cwd: PROJECT_ROOT, stdio: "inherit" });
}

function tool(script: string, ...args: string[]): string {
	return `node "${path.join(LIB_TOOLS, script)}" ${args.join(" ")}`;
}

// ── ESLint complexity check (no file write) ─────────────────────────

async function runESLintComplexity(): Promise<ESLint.LintResult[]> {
	const variant = getComplexityVariant(ESLINT_CONFIG);
	console.log("Running ESLint to collect complexity for all functions...");

	const eslint = new ESLint({
		cwd: PROJECT_ROOT,
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

interface FuncEntry { file: string; [key: string]: unknown }

async function generateDecisionPoints(eslintResults: ESLint.LintResult[]): Promise<void> {
	const variant = getComplexityVariant(ESLINT_CONFIG);

	const allFunctions: FuncEntry[] = extractFunctionsFromESLintResults(eslintResults, PROJECT_ROOT);
	const fileMap = new Map<string, FuncEntry[]>();
	for (const func of allFunctions) {
		if (!fileMap.has(func.file)) fileMap.set(func.file, []);
		fileMap.get(func.file)!.push(func);
	}

	const parseDPs = (source: string, boundaries: unknown, funcs: FuncEntry[], filePath: string) =>
		parseDecisionPointsAST(source, boundaries, funcs, filePath, PROJECT_ROOT, { variant });

	const files: unknown[] = [];
	let totalDecisionPoints = 0;

	for (const [filePath, funcs] of fileMap.entries()) {
		const fullPath = path.resolve(PROJECT_ROOT, filePath);
		if (!fs.existsSync(fullPath)) continue;
		let decisionPoints: Array<{ line: number; type: string; functionLine: number }>;
		try {
			const source = fs.readFileSync(fullPath, "utf-8");
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
		summary: { totalDecisionPoints, filesWithDecisionPoints: files.filter((f: any) => f.decisionPointCount > 0).length },
		files: (files as Array<{ file: string }>).sort((a, b) => a.file.localeCompare(b.file)),
	};

	const outputPath = path.join(OUTPUT_DIR, "decision-points-summary.json");
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
	console.log("Wrote", outputPath);
}

// ── Main pipeline ───────────────────────────────────────────────────

async function main(): Promise<void> {
	// 1. Run vitest with project config
	run(`npx vitest run --config "${VITEST_CONFIG}" --coverage --coverage.reportsDirectory=${COVERAGE_DIR} --coverage.reporter=json`);

	// 2. Convert coverage-final.json → coverage-summary.json
	run(tool("coverage-to-json.js", `${COVERAGE_DIR}/coverage-final.json`, `${COVERAGE_DIR}/coverage-summary.json`));

	// 3. Run ESLint decision-points analysis (no complexity/ artifact)
	const eslintResults = await runESLintComplexity();
	await generateDecisionPoints(eslintResults);

	// 4. Merge coverage + decision points → analysis.json
	run(tool("merge-coverage-decision-points.js", COVERAGE_DIR));

	console.log(`\nAnalysis complete. Output: ${COVERAGE_DIR}/analysis.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
