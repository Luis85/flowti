/**
 * generate-test-report.ts — CLI project test report generator.
 *
 * Reads vitest JSON output and generates a markdown TestReport.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

interface TestStats {
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	suites: number;
	durationMs: number;
	success: boolean;
}

function num(json: Record<string, unknown>, key: string, fallback = 0): number {
	return (json[key] as number) ?? fallback;
}

function extractTestStats(json: Record<string, unknown>): TestStats {
	const passed = num(json, "numPassedTests");
	const failed = num(json, "numFailedTests");
	const skipped = num(json, "numPendingTests");
	const total = num(json, "numTotalTests", passed + failed + skipped);
	const results = json.testResults as unknown[] | undefined;
	const suites = results?.length ?? num(json, "numTotalTestSuites");
	const startTime = json.startTime as number | undefined;
	const durationMs = startTime ? Math.max(0, clock.ms() - startTime) : 0;
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

export function generateTestReport(projectPath: string): GeneratorOutput {
	const svc = new ReportService(projectPath);
	const reportJson = svc.subdir("tests/testreport.json");

	if (!disk.existsSync(reportJson)) {
		log("[cli-report] No testreport.json found — run tests with --reporter=json first.");
		return { success: false, outputPath: "", metrics: {} };
	}

	const json = JSON.parse(disk.readFileSync(reportJson, "utf-8")) as Record<string, unknown>;
	const stats = extractTestStats(json);

	const fm: Record<string, string | number | boolean> = {
		type: "TestReport",
		project: "flowti-cli",
		date: clock.iso(),
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
		sourceJson: reportJson,
	});

	log(`[cli-report] Test Report`);
	log(`  Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`);
	log(`  Suites: ${stats.suites} | Duration: ${stats.durationMs}ms | Result: ${stats.success ? "PASS" : "FAIL"}`);
	log(`  Written: ${outputPath}`);

	const warnings: string[] = [];
	if (stats.failed > 0) warnings.push(`${stats.failed} test(s) failed`);

	return {
		success: true,
		outputPath,
		metrics: { total: stats.total, passed: stats.passed, failed: stats.failed, skipped: stats.skipped, suites: stats.suites },
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

// Self-invocation when run directly via tsx
import { CLI_PROJECT } from "../../../infrastructure/config.js";

// eslint-disable-next-line no-restricted-properties
if (process.argv[1]?.includes("generate-test-report")) {
	generateTestReport(CLI_PROJECT);
}
