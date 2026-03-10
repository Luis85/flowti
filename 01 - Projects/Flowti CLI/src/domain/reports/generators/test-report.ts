/**
 * generate-test-report.ts
 *
 * Reads the Vitest JSON report and generates a TestReport vault note
 * with queryable YAML frontmatter.  Includes a short performance
 * summary when data.json is available.
 *
 * Usage: node scripts/generate-test-report.ts [--build-type=flow|full]
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

import { proc } from "../../../infrastructure/proc.js";
import { clock } from "../../../infrastructure/clock.js";

const buildTypeArg = proc.argv().find((a) => a.startsWith("--build-type="));
const buildType = buildTypeArg ? buildTypeArg.split("=")[1] : "flow";

const REPORT_JSON = paths.join(PLUGIN_ROOT, "docs", "reports", "tests", "testreport.json");
const OUTPUT_DIR = paths.join(PLUGIN_ROOT, "docs", "reports", "tests");

const DATA_JSON_CANDIDATES: string[] = [
	paths.resolve(PLUGIN_ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
	paths.join(PLUGIN_ROOT, "data.json"),
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
		if (disk.existsSync(candidate)) {
			try {
				const data: Record<string, unknown> = JSON.parse(disk.readFileSync(candidate, "utf-8"));
				const sizeBytes = disk.statSync(candidate).size;
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

interface TestReportStats {
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	suites: number;
	duration_ms: number;
	success: boolean;
}

function jsonNum(json: Record<string, unknown>, key: string, fallback = 0): number {
	return (json[key] as number) ?? fallback;
}

function extractStats(json: Record<string, unknown>): TestReportStats {
	const passed = jsonNum(json, "numPassedTests");
	const failed = jsonNum(json, "numFailedTests");
	const skipped = jsonNum(json, "numPendingTests");
	const total = jsonNum(json, "numTotalTests", passed + failed + skipped);
	const results = json.testResults as unknown[] | undefined;
	const suites = results?.length ?? jsonNum(json, "numTotalTestSuites");
	const startTime = jsonNum(json, "startTime");
	const duration = startTime > 0 ? clock.ms() - startTime : 0;
	const success = (json.success as boolean) ?? failed === 0;
	return { passed, failed, skipped, total, suites, duration_ms: Math.max(0, duration), success };
}

function main(): void {
	if (!disk.existsSync(REPORT_JSON)) {
		return;
	}

	const json = JSON.parse(disk.readFileSync(REPORT_JSON, "utf-8")) as Record<string, unknown>;
	const now = clock.now();
	const stats = extractStats(json);

	const fm: Record<string, string | number | boolean> = {
		type: "TestReport",
		build_type: buildType,
		date: now.toISOString(),
		...stats,
	};

	const doc = Document.create("Test Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Test Report")
		.addBlank()
		.callout("info", "Summary", [
			`Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`,
			`Suites: ${stats.suites} | Duration: ${stats.duration_ms}ms`,
			`Result: ${stats.success ? "PASS" : "FAIL"}`,
		])
		.addBlank();

	doc.mergeFrontmatter(buildPerfSection(loadPerfData(), doc));

	const safeTimestamp = clock.safeIso();
	const prefix = buildType === "full" ? "" : `${buildType}-`;
	const outputPath = paths.join(OUTPUT_DIR, `${safeTimestamp}-${prefix}test-report.md`);
	doc.save(outputPath);
}

main();
