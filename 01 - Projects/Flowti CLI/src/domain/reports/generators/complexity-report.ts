/**
 * generate-complexity-report.ts
 *
 * Runs ESLint complexity analysis via the @pythonidaer/complexity-report
 * programmatic API (JSON-only, no HTML generation) and produces a
 * ComplexityReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-complexity-report.ts [--build-type=flow|increment|full]
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";

import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";

interface ESLintMessage {
	message: string;
	line: number;
}

interface ESLintResult {
	filePath: string;
	messages: ESLintMessage[];
}

interface ComplexityEntry {
	file: string;
	line: number;
	complexity: number;
}

interface DomainStats {
	functions: number;
	above10: number;
	maxComplexity: number;
	totalComplexity: number;
}

const { runESLintComplexityCheck } = await import("@pythonidaer/complexity-report/integration/eslint/index.js");

const COMPLEXITY_JSON: string = paths.join(ROOT, "complexity", "complexity-report.json");
const OUTPUT_DIR: string = paths.join(ROOT, "docs", "reports", "complexity");
const STABLE_PATH: string = paths.join(OUTPUT_DIR, "Complexity Report.md");

/**
 * Parse complexity values from ESLint messages.
 * Normalizes Windows absolute paths to plugin-relative paths.
 * Reason is hardcoded path handling in the plugin which breaks on windows.
 */
function extractComplexityEntries(data: ESLintResult[]): ComplexityEntry[] {
	const rootNorm: string = ROOT.replace(/\\/g, "/");
	const entries: ComplexityEntry[] = [];
	for (const file of data) {
		const absNorm: string = file.filePath.replace(/\\/g, "/");
		const relPath: string = absNorm.startsWith(rootNorm)
			? absNorm.substring(rootNorm.length + 1)
			: absNorm;
		for (const msg of file.messages) {
			const match = msg.message.match(/complexity of (\d+)/);
			if (!match) continue;
			entries.push({
				file: relPath,
				line: msg.line,
				complexity: parseInt(match[1], 10),
			});
		}
	}
	return entries;
}

function computeDistribution(entries: ComplexityEntry[]): Record<string, number> {
	const vals: number[] = entries.map((e: ComplexityEntry) => e.complexity);
	return {
		"1-5": vals.filter((v: number) => v >= 1 && v <= 5).length,
		"6-10": vals.filter((v: number) => v >= 6 && v <= 10).length,
		"11-20": vals.filter((v: number) => v >= 11 && v <= 20).length,
		"21-50": vals.filter((v: number) => v >= 21 && v <= 50).length,
		"51+": vals.filter((v: number) => v >= 51).length,
	};
}

function generateReport(data: ESLintResult[], entries: ComplexityEntry[]): string {
	const now = new Date();
	const totalFiles: number = data.length;
	const filesWithComplexity: number = data.filter((d: ESLintResult) => d.messages.length > 0).length;
	const totalFunctions: number = entries.length;
	const vals: number[] = entries.map((e: ComplexityEntry) => e.complexity);
	const aboveThreshold: number = vals.filter((v: number) => v > 10).length;
	const maxComplexity: number = vals.length > 0 ? Math.max(...vals) : 0;
	const avgComplexity: number = vals.length > 0 ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : 0;
	const medianComplexity: number = vals.length > 0 ? vals.sort((a: number, b: number) => a - b)[Math.floor(vals.length / 2)] : 0;
	const distribution: Record<string, number> = computeDistribution(entries);

	// Domain breakdown: group by first path segment after src/
	const domainMap: Record<string, DomainStats> = {};
	for (const e of entries) {
		const parts: string[] = e.file.replace(/^src\//, "").split("/");
		const domain: string = parts[0] || "root";
		if (!domainMap[domain]) domainMap[domain] = { functions: 0, above10: 0, maxComplexity: 0, totalComplexity: 0 };
		domainMap[domain].functions++;
		domainMap[domain].totalComplexity += e.complexity;
		if (e.complexity > 10) domainMap[domain].above10++;
		if (e.complexity > domainMap[domain].maxComplexity) domainMap[domain].maxComplexity = e.complexity;
	}

	const fm = {
		type: "ComplexityReport",
		date: now.toISOString(),
		total_files_analyzed: totalFiles,
		files_with_functions: filesWithComplexity,
		total_functions: totalFunctions,
		above_threshold: aboveThreshold,
		threshold: 10,
		max_complexity: maxComplexity,
		avg_complexity: parseFloat(avgComplexity.toFixed(1)),
		median_complexity: medianComplexity,
		node_version: process.version,
	};

	const topOffenders: ComplexityEntry[] = entries
		.sort((a: ComplexityEntry, b: ComplexityEntry) => b.complexity - a.complexity)
		.slice(0, 25);

	const doc = Document.create("Complexity Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Complexity Report")
		.addBlank()
		.callout("info", "Summary", [
			`Files: ${totalFiles} | Functions: ${totalFunctions} | Above threshold (>10): ${aboveThreshold}`,
			`Max: ${maxComplexity} | Avg: ${avgComplexity.toFixed(1)} | Median: ${medianComplexity}`,
		])
		.addBlank()
		.heading(2, "Distribution")
		.addBlank()
		.table(
			["Range", "Count", "%"],
			Object.entries(distribution).map(([range, count]: [string, number]) => [
				range, String(count), `${((count / totalFunctions) * 100).toFixed(1)}%`,
			]),
			{ alignRight: [1, 2] },
		)
		.addBlank()
		.heading(2, "Top 25 Most Complex Functions")
		.addBlank()
		.table(
			["#", "Complexity", "File", "Line"],
			topOffenders.map((e: ComplexityEntry, i: number) => [String(i + 1), String(e.complexity), `\`${e.file}\``, String(e.line)]),
			{ alignRight: [0, 1, 3] },
		)
		.addBlank()
		.heading(2, "Domain Breakdown")
		.addBlank()
		.table(
			["Domain", "Functions", "Above 10", "Max", "Avg"],
			Object.entries(domainMap)
				.sort((a: [string, DomainStats], b: [string, DomainStats]) => b[1].above10 - a[1].above10)
				.map(([domain, stats]: [string, DomainStats]) => [
					domain, String(stats.functions), String(stats.above10),
					String(stats.maxComplexity), (stats.totalComplexity / stats.functions).toFixed(1),
				]),
			{ alignRight: [1, 2, 3, 4] },
		)
		.addBlank();

	return doc.toString();
}

async function main(): Promise<void> {
	// Run ESLint complexity check directly — produces JSON only, no HTML
	try {
		await runESLintComplexityCheck(ROOT);
	} catch {
		console.warn("[report] ESLint complexity check failed — checking for existing JSON.");
	}

	if (!disk.existsSync(COMPLEXITY_JSON)) {
		log("[report] No complexity-report.json found — skipping complexity report.");
		return;
	}

	const data: ESLintResult[] = JSON.parse(disk.readFileSync(COMPLEXITY_JSON, "utf-8"));
	const entries: ComplexityEntry[] = extractComplexityEntries(data);
	const content: string = generateReport(data, entries);

	disk.mkdirSync(OUTPUT_DIR, { recursive: true });

	// Write timestamped report
	const now = new Date();
	const safeTimestamp: string = now.toISOString().replace(/:/g, "-");
	const filename: string = `${safeTimestamp}-complexity-report.md`;
	const timestampedPath: string = paths.join(OUTPUT_DIR, filename);
	disk.writeFileSync(timestampedPath, content, "utf-8");

	// Write stable report (overwrite)
	disk.writeFileSync(STABLE_PATH, content, "utf-8");

	log(`[report] ComplexityReport written: ${timestampedPath}`);
}

main();
