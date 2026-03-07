/**
 * generate-test-report.ts
 *
 * Reads the Vitest JSON report and generates a TestReport vault note
 * with queryable YAML frontmatter.  Includes a short performance
 * summary when data.json is available.
 *
 * Usage: node scripts/generate-test-report.ts [--build-type=flow|full]
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const buildTypeArg = process.argv.find((a) => a.startsWith("--build-type="));
const buildType = buildTypeArg ? buildTypeArg.split("=")[1] : "flow";

const REPORT_JSON = path.join(ROOT, "docs", "reports", "tests", "testreport.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "tests");

const DATA_JSON_CANDIDATES: string[] = [
	path.resolve(ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
	path.join(ROOT, "data.json"),
];

function round(n: number): number {
	return Math.round(n * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface PerfData {
	data: Record<string, unknown>;
	sizeBytes: number;
}

function loadPerfData(): PerfData | null {
	for (const candidate of DATA_JSON_CANDIDATES) {
		if (fs.existsSync(candidate)) {
			try {
				const data: Record<string, unknown> = JSON.parse(fs.readFileSync(candidate, "utf-8"));
				const sizeBytes = fs.statSync(candidate).size;
				return { data, sizeBytes };
			} catch { /* try next */ }
		}
	}
	return null;
}

function buildPerfSection(perfResult: PerfData | null, doc: Document): Record<string, number> {
	if (!perfResult) return {};

	const { data, sizeBytes } = perfResult;
	const perfState = (data?.perfAggregator as Record<string, unknown>) ?? {};
	const startupHistory: number[] = (perfState.startupHistory as number[]) ?? [];
	const sorted = [...startupHistory].sort((a, b) => a - b);

	const startupP50 = round(percentile(sorted, 0.5));
	const startupP95 = round(percentile(sorted, 0.95));
	const startupMax = round(sorted[sorted.length - 1] ?? 0);
	const lastStartup = round(startupHistory[startupHistory.length - 1] ?? 0);

	doc
		.heading(2, "Performance")
		.addBlank()
		.callout("tip", "Startup", [
			`Last: ${lastStartup}ms | p50: ${startupP50}ms | p95: ${startupP95}ms | Max: ${startupMax}ms`,
			`Measurements: ${startupHistory.length} | data.json: ${formatBytes(sizeBytes)}`,
		])
		.addBlank();

	return {
		startup_p50: startupP50,
		startup_p95: startupP95,
		startup_max: startupMax,
		startup_measurements: startupHistory.length,
		data_json_size_bytes: sizeBytes,
	};
}

function main(): void {
	if (!fs.existsSync(REPORT_JSON)) {
		console.log("[report] No testreport.json found — run tests first.");
		return;
	}

	const json = JSON.parse(fs.readFileSync(REPORT_JSON, "utf-8"));
	const now = new Date();
	const date = now.toISOString();

	const passed: number = json.numPassedTests ?? 0;
	const failed: number = json.numFailedTests ?? 0;
	const skipped: number = json.numPendingTests ?? 0;
	const total: number = json.numTotalTests ?? passed + failed + skipped;
	const suites: number = json.testResults?.length ?? json.numTotalTestSuites ?? 0;
	const startTime: number = json.startTime ?? 0;
	const duration: number = startTime > 0 ? Date.now() - startTime : 0;

	const fm: Record<string, string | number | boolean> = {
		type: "TestReport",
		build_type: buildType,
		date,
		passed,
		failed,
		skipped,
		total,
		suites,
		duration_ms: duration > 0 ? duration : 0,
		success: json.success ?? failed === 0,
	};

	const doc = Document.create("Test Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Test Report")
		.addBlank()
		.callout("info", "Summary", [
			`Total: ${fm.total} | Passed: ${fm.passed} | Failed: ${fm.failed} | Skipped: ${fm.skipped}`,
			`Suites: ${fm.suites} | Duration: ${fm.duration_ms}ms`,
			`Result: ${fm.success ? "PASS" : "FAIL"}`,
		])
		.addBlank();

	const perfFm = buildPerfSection(loadPerfData(), doc);
	doc.mergeFrontmatter(perfFm);

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const prefix = buildType === "full" ? "" : `${buildType}-`;
	const filename = `${safeTimestamp}-${prefix}test-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] TestReport written: ${outputPath}`);
}

main();
