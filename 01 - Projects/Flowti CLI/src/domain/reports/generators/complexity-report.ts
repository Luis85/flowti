/**
 * generate-complexity-report.ts
 *
 * Runs TypeScript AST complexity analysis on the plugin source and produces
 * a ComplexityReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-complexity-report.ts [--build-type=flow|increment|full]
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";

import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

import { clock } from "../../../infrastructure/clock.js";
import { analyzeComplexity } from "../cli/complexity-analyzer.js";
import type { ComplexityFunction } from "../cli/complexity-analyzer.js";

interface DomainStats {
	functions: number;
	above10: number;
	maxComplexity: number;
	totalComplexity: number;
}

const OUTPUT_DIR: string = paths.join(PLUGIN_ROOT, "docs", "reports", "complexity");
const STABLE_PATH: string = paths.join(OUTPUT_DIR, "Complexity Report.md");

function computeDistribution(entries: ComplexityFunction[]): Record<string, number> {
	const vals: number[] = entries.map((e) => e.complexity);
	return {
		"1-5": vals.filter((v) => v >= 1 && v <= 5).length,
		"6-10": vals.filter((v) => v >= 6 && v <= 10).length,
		"11-20": vals.filter((v) => v >= 11 && v <= 20).length,
		"21-50": vals.filter((v) => v >= 21 && v <= 50).length,
		"51+": vals.filter((v) => v >= 51).length,
	};
}

function generateReport(entries: ComplexityFunction[], totalFiles: number): string {
	const now = clock.now();
	const filesWithComplexity = new Set(entries.map((e) => e.file)).size;
	const totalFunctions = entries.length;
	const vals = entries.map((e) => e.complexity);
	const aboveThreshold = vals.filter((v) => v > 10).length;
	const maxComplexity = vals.length > 0 ? Math.max(...vals) : 0;
	const avgComplexity = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
	const sorted = [...vals].sort((a, b) => a - b);
	const medianComplexity = vals.length > 0 ? sorted[Math.floor(vals.length / 2)] : 0;
	const distribution = computeDistribution(entries);

	// Domain breakdown: group by first path segment after src/
	const domainMap: Record<string, DomainStats> = {};
	for (const e of entries) {
		const parts = e.file.replace(/^src\//, "").split("/");
		const domain = parts[0] || "root";
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
	};

	const topOffenders = entries
		.sort((a, b) => b.complexity - a.complexity)
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
			Object.entries(distribution).map(([range, count]) => [
				range, String(count), `${((count / totalFunctions) * 100).toFixed(1)}%`,
			]),
			{ alignRight: [1, 2] },
		)
		.addBlank()
		.heading(2, "Top 25 Most Complex Functions")
		.addBlank()
		.table(
			["#", "Complexity", "File", "Line"],
			topOffenders.map((e, i) => [String(i + 1), String(e.complexity), `\`${e.file}\``, String(e.line)]),
			{ alignRight: [0, 1, 3] },
		)
		.addBlank()
		.heading(2, "Domain Breakdown")
		.addBlank()
		.table(
			["Domain", "Functions", "Above 10", "Max", "Avg"],
			Object.entries(domainMap)
				.sort((a, b) => b[1].above10 - a[1].above10)
				.map(([domain, stats]) => [
					domain, String(stats.functions), String(stats.above10),
					String(stats.maxComplexity), (stats.totalComplexity / stats.functions).toFixed(1),
				]),
			{ alignRight: [1, 2, 3, 4] },
		)
		.addBlank();

	return doc.toString();
}

async function main(): Promise<void> {
	const srcDir = paths.join(PLUGIN_ROOT, "src");
	const result = analyzeComplexity(srcDir, PLUGIN_ROOT);
	const content = generateReport(result.functions, result.files.length);

	disk.mkdirSync(OUTPUT_DIR, { recursive: true });

	// Write timestamped report
	const safeTimestamp = clock.safeIso();
	const filename = `${safeTimestamp}-complexity-report.md`;
	const timestampedPath = paths.join(OUTPUT_DIR, filename);
	disk.writeFileSync(timestampedPath, content, "utf-8");

	// Write stable report (overwrite)
	disk.writeFileSync(STABLE_PATH, content, "utf-8");
}

main();
