/**
 * generate-test-report.mjs
 *
 * Reads the Vitest JSON report and generates a TestReport vault note
 * with queryable YAML frontmatter.  Includes a short performance
 * summary when data.json is available.
 *
 * Usage: node scripts/generate-test-report.mjs [--build-type=flow|full]
 */

import fs from "node:fs";
import path from "node:path";
const CLI_PROJECT = path.resolve(import.meta.dirname, "..");
const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
const ROOT = path.resolve(VAULT_ROOT, "Development", "flowti");

const buildTypeArg = process.argv.find((a) => a.startsWith("--build-type="));
const buildType = buildTypeArg ? buildTypeArg.split("=")[1] : "flow";

const REPORT_JSON = path.join(ROOT, "docs", "reports", "tests", "testreport.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "tests");

const DATA_JSON_CANDIDATES = [
	path.resolve(ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
	path.join(ROOT, "data.json"),
];

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

function round(n) {
	return Math.round(n * 100) / 100;
}

function percentile(sorted, p) {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function loadPerfData() {
	for (const candidate of DATA_JSON_CANDIDATES) {
		if (fs.existsSync(candidate)) {
			try {
				const data = JSON.parse(fs.readFileSync(candidate, "utf-8"));
				const sizeBytes = fs.statSync(candidate).size;
				return { data, sizeBytes };
			} catch { /* try next */ }
		}
	}
	return null;
}

function buildPerfSection(perfResult) {
	if (!perfResult) return { fm: {}, body: "" };

	const { data, sizeBytes } = perfResult;
	const perfState = data?.perfAggregator ?? {};
	const startupHistory = perfState.startupHistory ?? [];
	const sorted = [...startupHistory].sort((a, b) => a - b);

	const startupP50 = round(percentile(sorted, 0.5));
	const startupP95 = round(percentile(sorted, 0.95));
	const startupMax = round(sorted[sorted.length - 1] ?? 0);
	const lastStartup = round(startupHistory[startupHistory.length - 1] ?? 0);

	const fm = {
		startup_p50: startupP50,
		startup_p95: startupP95,
		startup_max: startupMax,
		startup_measurements: startupHistory.length,
		data_json_size_bytes: sizeBytes,
	};

	const lines = [
		"## Performance",
		"",
		"> [!tip] Startup",
		`> Last: ${lastStartup}ms | p50: ${startupP50}ms | p95: ${startupP95}ms | Max: ${startupMax}ms`,
		`> Measurements: ${startupHistory.length} | data.json: ${formatBytes(sizeBytes)}`,
		"",
	];

	return { fm, body: lines.join("\n") };
}

function main() {
	if (!fs.existsSync(REPORT_JSON)) {
		console.log("[report] No testreport.json found — run tests first.");
		return;
	}

	const json = JSON.parse(fs.readFileSync(REPORT_JSON, "utf-8"));
	const now = new Date();
	const date = now.toISOString();

	const passed = json.numPassedTests ?? 0;
	const failed = json.numFailedTests ?? 0;
	const skipped = json.numPendingTests ?? 0;
	const total = json.numTotalTests ?? passed + failed + skipped;
	const suites = json.testResults?.length ?? json.numTotalTestSuites ?? 0;
	const startTime = json.startTime ?? 0;
	const duration = startTime > 0 ? Date.now() - startTime : 0;

	const perf = buildPerfSection(loadPerfData());

	const fm = {
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
		...perf.fm,
	};

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	const body = [
		"",
		"# Test Report",
		"",
		"> [!info] Summary",
		`> Total: ${fm.total} | Passed: ${fm.passed} | Failed: ${fm.failed} | Skipped: ${fm.skipped}`,
		`> Suites: ${fm.suites} | Duration: ${fm.duration_ms}ms`,
		`> Result: ${fm.success ? "PASS" : "FAIL"}`,
		"",
		perf.body,
	].join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const prefix = buildType === "full" ? "" : `${buildType}-`;
	const filename = `${safeTimestamp}-${prefix}test-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body, "utf-8");

	console.log(`[report] TestReport written: ${outputPath}`);
}

main();
