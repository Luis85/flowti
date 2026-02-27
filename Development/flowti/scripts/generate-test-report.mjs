/**
 * generate-test-report.mjs
 *
 * Reads the Vitest JSON report and generates a TestReport vault note
 * with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-test-report.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REPORT_JSON = path.join(ROOT, "docs", "reports", "tests", "testreport.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "tests");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
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

	const fm = {
		type: "TestReport",
		date,
		passed,
		failed,
		skipped,
		total,
		suites,
		duration_ms: duration > 0 ? duration : 0,
		success: json.success ?? failed === 0,
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
	].join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-test-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body, "utf-8");

	console.log(`[report] TestReport written: ${outputPath}`);
}

main();
