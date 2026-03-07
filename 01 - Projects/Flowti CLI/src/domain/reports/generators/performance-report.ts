/**
 * generate-performance-report.ts
 *
 * Reads persisted performance state (data.json perf key) and generates
 * a PerformanceReport vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-performance-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

// The plugin stores state in the Obsidian vault's plugin data folder.
// During builds the data.json may be at the vault root's plugin dir.
const DATA_JSON_CANDIDATES: string[] = [
	path.resolve(ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
	path.join(ROOT, "data.json"),
];
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "performance");

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function main(): void {
	let data: Record<string, unknown> | null = null;
	for (const candidate of DATA_JSON_CANDIDATES) {
		if (fs.existsSync(candidate)) {
			try {
				data = JSON.parse(fs.readFileSync(candidate, "utf-8"));
				console.log(`[report] Read data.json from: ${candidate}`);
				break;
			} catch { /* try next */ }
		}
	}

	const now = new Date();
	const date = now.toISOString();

	// Extract perf state (may not exist yet)
	const perfState = (data as Record<string, unknown>)?.perfAggregator as Record<string, unknown> ?? {};
	const startupHistory: number[] = (perfState.startupHistory as number[]) ?? [];
	const sorted = [...startupHistory].sort((a, b) => a - b);

	const fm: Record<string, string | number> = {
		type: "PerformanceReport",
		date,
		startup_total_ms: round(startupHistory[startupHistory.length - 1] ?? 0),
		startup_measurements: startupHistory.length,
		startup_p50: round(percentile(sorted, 0.5)),
		startup_p95: round(percentile(sorted, 0.95)),
		startup_max: round(sorted[sorted.length - 1] ?? 0),
		data_json_size_bytes: data ? JSON.stringify(data).length : 0,
	};

	const doc = Document.create("Performance Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Performance Report")
		.addBlank()
		.callout("info", "Summary", [
			`Last startup: ${fm.startup_total_ms}ms | p50: ${fm.startup_p50}ms | p95: ${fm.startup_p95}ms | Max: ${fm.startup_max}ms`,
			`Measurements: ${fm.startup_measurements} | data.json: ${formatBytes(fm.data_json_size_bytes as number)}`,
		])
		.addBlank()
		.heading(2, "Startup History")
		.addBlank()
		.table(
			["#", "Duration"],
			startupHistory.map((ms, i) => [String(i + 1), `${round(ms)}ms`]),
		)
		.addBlank();

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-performance-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] PerformanceReport written: ${outputPath}`);
}

main();
