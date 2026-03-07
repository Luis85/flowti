/**
 * generate-test-report.ts — CLI project test report generator.
 *
 * Reads vitest JSON output and generates a markdown TestReport
 * for the CLI project itself.
 *
 * Usage: tsx src/domain/reports/cli/generate-test-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const REPORT_JSON = path.join(CLI_PROJECT, "docs", "reports", "tests", "testreport.json");
const OUTPUT_DIR = path.join(CLI_PROJECT, "docs", "reports", "tests");

function main(): void {
	if (!fs.existsSync(REPORT_JSON)) {
		console.log("[cli-report] No testreport.json found — run tests with --reporter=json first.");
		return;
	}

	const json = JSON.parse(fs.readFileSync(REPORT_JSON, "utf-8"));
	const now = new Date();

	const passed: number = json.numPassedTests ?? 0;
	const failed: number = json.numFailedTests ?? 0;
	const skipped: number = json.numPendingTests ?? 0;
	const total: number = json.numTotalTests ?? passed + failed + skipped;
	const suites: number = json.testResults?.length ?? json.numTotalTestSuites ?? 0;
	const durationMs: number = json.startTime ? Date.now() - json.startTime : 0;

	const fm: Record<string, string | number | boolean> = {
		type: "TestReport",
		project: "flowti-cli",
		date: now.toISOString(),
		passed,
		failed,
		skipped,
		total,
		suites,
		duration_ms: Math.max(0, durationMs),
		success: json.success ?? failed === 0,
	};

	const doc = Document.create("CLI Test Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Test Report")
		.addBlank()
		.callout("info", "Summary", [
			`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`,
			`Suites: ${suites} | Duration: ${fm.duration_ms}ms`,
			`Result: ${fm.success ? "PASS" : "FAIL"}`,
		])
		.addBlank();

	// Per-suite breakdown
	const testResults = json.testResults as Array<{ name: string; status: string; assertionResults?: Array<{ status: string }> }> | undefined;
	if (testResults && testResults.length > 0) {
		doc.heading(2, "Suites").addBlank();
		const rows = testResults.map((suite) => {
			const rel = suite.name.replace(/\\/g, "/").split("Flowti CLI/").pop() ?? suite.name;
			const tests = suite.assertionResults?.length ?? 0;
			const p = suite.assertionResults?.filter((a) => a.status === "passed").length ?? 0;
			return [rel, String(tests), String(p), suite.status === "passed" ? "PASS" : "FAIL"];
		});
		doc.table(["Suite", "Tests", "Passed", "Status"], rows, { alignRight: [1, 2] }).addBlank();
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const outputPath = path.join(OUTPUT_DIR, `${safeTimestamp}-test-report.md`);
	doc.save(outputPath);

	// Stable path
	doc.save(path.join(OUTPUT_DIR, "Test Report.md"));

	console.log(`[cli-report] TestReport written: ${outputPath}`);
}

main();
