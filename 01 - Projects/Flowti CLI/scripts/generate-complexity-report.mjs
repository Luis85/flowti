/**
 * generate-complexity-report.mjs
 *
 * Runs ESLint complexity analysis via the @pythonidaer/complexity-report
 * programmatic API (JSON-only, no HTML generation) and produces a
 * ComplexityReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-complexity-report.mjs [--build-type=flow|increment|full]
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ROOT } from "../src/infrastructure/config.mjs";
import { Document } from "../src/infrastructure/document.mjs";

// Resolve external dep from the plugin's node_modules (not installed in CLI project)
const depPath = pathToFileURL(path.join(ROOT, "node_modules", "@pythonidaer", "complexity-report", "integration", "eslint", "index.js")).href;
const { runESLintComplexityCheck } = await import(depPath);

const COMPLEXITY_JSON = path.join(ROOT, "complexity", "complexity-report.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "complexity");
const STABLE_PATH = path.join(OUTPUT_DIR, "Complexity Report.md");

/**
 * Parse complexity values from ESLint messages.
 * Normalizes Windows absolute paths to plugin-relative paths.
 * Reason is hardcoded path handling in the plugin which breaks on windows.
 */
function extractComplexityEntries(data) {
	const rootNorm = ROOT.replace(/\\/g, "/");
	const entries = [];
	for (const file of data) {
		const absNorm = file.filePath.replace(/\\/g, "/");
		const relPath = absNorm.startsWith(rootNorm)
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

function computeDistribution(entries) {
	const vals = entries.map((e) => e.complexity);
	return {
		"1-5": vals.filter((v) => v >= 1 && v <= 5).length,
		"6-10": vals.filter((v) => v >= 6 && v <= 10).length,
		"11-20": vals.filter((v) => v >= 11 && v <= 20).length,
		"21-50": vals.filter((v) => v >= 21 && v <= 50).length,
		"51+": vals.filter((v) => v >= 51).length,
	};
}

function generateReport(data, entries) {
	const now = new Date();
	const totalFiles = data.length;
	const filesWithComplexity = data.filter((d) => d.messages.length > 0).length;
	const totalFunctions = entries.length;
	const vals = entries.map((e) => e.complexity);
	const aboveThreshold = vals.filter((v) => v > 10).length;
	const maxComplexity = vals.length > 0 ? Math.max(...vals) : 0;
	const avgComplexity = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
	const medianComplexity = vals.length > 0 ? vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)] : 0;
	const distribution = computeDistribution(entries);

	// Domain breakdown: group by first path segment after src/
	const domainMap = {};
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
		node_version: process.version,
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

async function main() {
	// Run ESLint complexity check directly — produces JSON only, no HTML
	try {
		await runESLintComplexityCheck(ROOT);
	} catch (err) {
		console.warn("[report] ESLint complexity check failed — checking for existing JSON.");
	}

	if (!fs.existsSync(COMPLEXITY_JSON)) {
		console.log("[report] No complexity-report.json found — skipping complexity report.");
		return;
	}

	const data = JSON.parse(fs.readFileSync(COMPLEXITY_JSON, "utf-8"));
	const entries = extractComplexityEntries(data);
	const content = generateReport(data, entries);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	// Write timestamped report
	const now = new Date();
	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-complexity-report.md`;
	const timestampedPath = path.join(OUTPUT_DIR, filename);
	fs.writeFileSync(timestampedPath, content, "utf-8");

	// Write stable report (overwrite)
	fs.writeFileSync(STABLE_PATH, content, "utf-8");

	console.log(`[report] ComplexityReport written: ${timestampedPath}`);
}

main();
