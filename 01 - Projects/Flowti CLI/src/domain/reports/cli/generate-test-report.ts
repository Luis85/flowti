/**
 * generate-test-report.ts — CLI project test report generator.
 *
 * Reads vitest JSON output and generates a markdown TestReport.
 *
 * Usage: tsx src/domain/reports/cli/generate-test-report.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";

const svc = new ReportService();
const REPORT_JSON = svc.subdir("tests/testreport.json");

interface TestStats {
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	suites: number;
	durationMs: number;
	success: boolean;
}

function extractTestStats(json: Record<string, unknown>): TestStats {
	const passed = (json.numPassedTests as number) ?? 0;
	const failed = (json.numFailedTests as number) ?? 0;
	const skipped = (json.numPendingTests as number) ?? 0;
	const total = (json.numTotalTests as number) ?? passed + failed + skipped;
	const results = json.testResults as unknown[] | undefined;
	const suites = results?.length ?? (json.numTotalTestSuites as number) ?? 0;
	const startTime = json.startTime as number | undefined;
	const durationMs = startTime ? Math.max(0, Date.now() - startTime) : 0;
	return { passed, failed, skipped, total, suites, durationMs, success: (json.success as boolean) ?? failed === 0 };
}

function addSuitesTable(doc: Document, json: Record<string, unknown>): void {
	const testResults = json.testResults as Array<{ name: string; status: string; assertionResults?: Array<{ status: string }> }> | undefined;
	if (!testResults || testResults.length === 0) return;

	doc.heading(2, "Suites").addBlank();
	const rows = testResults.map((suite) => {
		const rel = suite.name.replace(/\\/g, "/").split("Flowti CLI/").pop() ?? suite.name;
		const tests = suite.assertionResults?.length ?? 0;
		const p = suite.assertionResults?.filter((a) => a.status === "passed").length ?? 0;
		return [rel, String(tests), String(p), suite.status === "passed" ? "PASS" : "FAIL"];
	});
	doc.table(["Suite", "Tests", "Passed", "Status"], rows, { alignRight: [1, 2] }).addBlank();
}

function main(): void {
	if (!disk.existsSync(REPORT_JSON)) {
		log("[cli-report] No testreport.json found — run tests with --reporter=json first.");
		return;
	}

	const json = JSON.parse(disk.readFileSync(REPORT_JSON, "utf-8")) as Record<string, unknown>;
	const stats = extractTestStats(json);

	const fm: Record<string, string | number | boolean> = {
		type: "TestReport",
		project: "flowti-cli",
		date: new Date().toISOString(),
		passed: stats.passed,
		failed: stats.failed,
		skipped: stats.skipped,
		total: stats.total,
		suites: stats.suites,
		duration_ms: stats.durationMs,
		success: stats.success,
	};

	const doc = Document.create("CLI Test Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "CLI Test Report")
		.addBlank()
		.callout("info", "Summary", [
			`Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`,
			`Suites: ${stats.suites} | Duration: ${stats.durationMs}ms`,
			`Result: ${stats.success ? "PASS" : "FAIL"}`,
		])
		.addBlank();

	addSuitesTable(doc, json);

	const outputPath = svc.save(doc, {
		subdir: "tests",
		slug: "test-report",
		stableFilename: "Test Report.md",
		sourceJson: REPORT_JSON,
	});

	log(`[cli-report] TestReport written: ${outputPath}`);
}

main();
