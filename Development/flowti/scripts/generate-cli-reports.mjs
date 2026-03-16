#!/usr/bin/env node
/**
 * Generates CLI-compatible health reports from Plugin test/coverage output.
 *
 * Reads vitest JSON output and v8 coverage summary, writes markdown
 * reports with YAML frontmatter that the CLI's health system can parse.
 *
 * Outputs:
 *   docs/reports/Test Report.md    — test metrics (total, passed, failed, suites)
 *   docs/reports/Coverage Report.md — coverage metrics (lines_pct, branches_pct, etc.)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORTS_DIR = resolve(ROOT, "docs/reports");

function ensureDir(dir) {
	mkdirSync(dir, { recursive: true });
}

// ── Test Report ─────────────────────────────────────────────

function generateTestReport() {
	const inputPath = resolve(REPORTS_DIR, "tests/testreport.json");
	const outputPath = resolve(REPORTS_DIR, "Test Report.md");

	if (!existsSync(inputPath)) {
		console.warn("⚠ No testreport.json found — run vitest with --reporter=json first");
		return false;
	}

	const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
	const suites = raw.numTotalTestSuites ?? raw.testResults?.length ?? 0;
	const total = raw.numTotalTests ?? 0;
	const passed = raw.numPassedTests ?? 0;
	const failed = raw.numFailedTests ?? 0;
	const skipped = raw.numPendingTests ?? 0;
	const duration = raw.startTime && raw.testResults
		? Math.max(...raw.testResults.map(r => r.endTime ?? 0)) - raw.startTime
		: 0;

	const md = `---
type: TestReport
project: Flowti Plugin
date: ${new Date().toISOString()}
total: ${total}
passed: ${passed}
failed: ${failed}
skipped: ${skipped}
suites: ${suites}
duration_ms: ${duration}
success: ${failed === 0}
---

# Test Report — Flowti Plugin

| Metric | Value |
|--------|-------|
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| Suites | ${suites} |
| Duration | ${duration}ms |
| Success | ${failed === 0} |
`;

	ensureDir(dirname(outputPath));
	writeFileSync(outputPath, md);
	console.log(`✓ Test Report: ${total} tests (${passed} passed, ${failed} failed)`);
	return true;
}

// ── Coverage Report ─────────────────────────────────────────

function generateCoverageReport() {
	const inputPath = resolve(REPORTS_DIR, "coverage/coverage-summary.json");
	const outputPath = resolve(REPORTS_DIR, "Coverage Report.md");

	if (!existsSync(inputPath)) {
		console.warn("⚠ No coverage-summary.json found — run vitest with --coverage first");
		return false;
	}

	const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
	const totals = raw.total ?? {};
	const lines = totals.lines?.pct ?? 0;
	const branches = totals.branches?.pct ?? 0;
	const functions = totals.functions?.pct ?? 0;
	const statements = totals.statements?.pct ?? 0;

	const md = `---
type: CoverageReport
project: Flowti Plugin
date: ${new Date().toISOString()}
lines_pct: ${lines}
branches_pct: ${branches}
functions_pct: ${functions}
statements_pct: ${statements}
---

# Coverage Report — Flowti Plugin

| Metric | Coverage |
|--------|----------|
| Lines | ${lines}% |
| Branches | ${branches}% |
| Functions | ${functions}% |
| Statements | ${statements}% |
`;

	ensureDir(dirname(outputPath));
	writeFileSync(outputPath, md);
	console.log(`✓ Coverage Report: ${lines}% lines, ${branches}% branches, ${functions}% functions`);
	return true;
}

// ── Main ────────────────────────────────────────────────────

const testOk = generateTestReport();
const coverageOk = generateCoverageReport();

if (!testOk && !coverageOk) {
	console.error("✗ No report data found. Run tests first.");
	process.exit(1);
}
