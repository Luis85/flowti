/**
 * generate-complexity-report.ts — CLI project complexity report generator.
 *
 * Runs ESLint complexity analysis on the CLI source via @pythonidaer/complexity-report
 * and generates a markdown ComplexityReport for the CLI project.
 *
 * Usage: tsx src/domain/reports/cli/generate-complexity-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const { runESLintComplexityCheck } = await import("@pythonidaer/complexity-report/integration/eslint/index.js");

const COMPLEXITY_JSON = path.join(CLI_PROJECT, "complexity", "complexity-report.json");
const OUTPUT_DIR = path.join(CLI_PROJECT, "docs", "reports", "complexity");

interface ESLintMessage { message: string; line: number }
interface ESLintResult { filePath: string; messages: ESLintMessage[] }
interface ComplexityEntry { file: string; line: number; complexity: number }

function extractEntries(data: ESLintResult[]): ComplexityEntry[] {
	const rootNorm = CLI_PROJECT.replace(/\\/g, "/");
	const entries: ComplexityEntry[] = [];
	for (const file of data) {
		const absNorm = file.filePath.replace(/\\/g, "/");
		const relPath = absNorm.startsWith(rootNorm) ? absNorm.substring(rootNorm.length + 1) : absNorm;
		for (const msg of file.messages) {
			const match = msg.message.match(/complexity of (\d+)/);
			if (!match) continue;
			entries.push({ file: relPath, line: msg.line, complexity: parseInt(match[1], 10) });
		}
	}
	return entries;
}

function main(): void {
	// Run ESLint complexity check on CLI source
	try {
		runESLintComplexityCheck(CLI_PROJECT);
	} catch {
		console.warn("[cli-report] ESLint complexity check failed — checking for existing JSON.");
	}

	if (!fs.existsSync(COMPLEXITY_JSON)) {
		console.log("[cli-report] No complexity-report.json found — skipping.");
		return;
	}

	const data: ESLintResult[] = JSON.parse(fs.readFileSync(COMPLEXITY_JSON, "utf-8"));
	const entries = extractEntries(data);
	const now = new Date();
	const vals = entries.map((e) => e.complexity);
	const totalFunctions = entries.length;
	const aboveThreshold = vals.filter((v) => v > 10).length;
	const maxComplexity = vals.length > 0 ? Math.max(...vals) : 0;
	const avgComplexity = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;

	const fm: Record<string, string | number> = {
		type: "ComplexityReport",
		project: "flowti-cli",
		date: now.toISOString(),
		total_files: data.length,
		total_functions: totalFunctions,
		above_threshold: aboveThreshold,
		threshold: 10,
		max_complexity: maxComplexity,
		avg_complexity: parseFloat(avgComplexity.toFixed(1)),
	};

	const doc = Document.create("CLI Complexity Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Complexity Report")
		.addBlank()
		.callout("info", "Summary", [
			`Files: ${data.length} | Functions: ${totalFunctions} | Above threshold (>10): ${aboveThreshold}`,
			`Max: ${maxComplexity} | Avg: ${avgComplexity.toFixed(1)}`,
		])
		.addBlank();

	// Top offenders
	const top = entries.sort((a, b) => b.complexity - a.complexity).slice(0, 15);
	if (top.length > 0) {
		doc.heading(2, "Top Complex Functions").addBlank();
		doc.table(
			["#", "Complexity", "File", "Line"],
			top.map((e, i) => [String(i + 1), String(e.complexity), `\`${e.file}\``, String(e.line)]),
			{ alignRight: [0, 1, 3] },
		).addBlank();
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const outputPath = path.join(OUTPUT_DIR, `${safeTimestamp}-complexity-report.md`);
	doc.save(outputPath);
	doc.save(path.join(OUTPUT_DIR, "Complexity Report.md"));

	console.log(`[cli-report] ComplexityReport written: ${outputPath}`);
}

main();
