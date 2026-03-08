/**
 * summary-promotion.ts — Frontmatter promotion and Metrics Dictionary
 * for the summary report.
 *
 * Extracted from summary-renderers.ts for file-size compliance.
 */

import type { Document } from "../../../infrastructure/document.js";
import type {
	ReportSnapshot,
	JsonDataSources,
	DetailedSources,
	LintResult,
	TypeDocResult,
} from "./summary-types.js";
import { fm } from "./summary-analyzers.js";
import { buildDomainMetrics } from "./summary-renderers.js";

// ── Frontmatter promotion ────────────────────────────────────────────

export function promoteCoverage(fmData: Record<string, string | number | boolean>, snapshots: ReportSnapshot[], json: JsonDataSources): void {
	if (json.coverage) {
		fmData.coverage_lines_pct = json.coverage.linesPct;
		fmData.coverage_branches_pct = json.coverage.branchesPct;
		fmData.coverage_functions_pct = json.coverage.functionsPct;
		fmData.coverage_files = json.coverage.filesCovered;
	} else {
		for (const snap of snapshots) {
			if (snap.label !== "Coverage") continue;
			const lp = fm(snap, "lines_pct", "lines", "line_coverage");
			const bp = fm(snap, "branches_pct", "branches", "branch_coverage");
			if (lp > 0) fmData.coverage_lines_pct = lp;
			if (bp > 0) fmData.coverage_branches_pct = bp;
		}
	}
}

export function promoteTests(fmData: Record<string, string | number | boolean>, snapshots: ReportSnapshot[], json: JsonDataSources): void {
	if (json.tests) {
		fmData.total_tests = json.tests.numTotalTests;
		fmData.total_suites = json.tests.numTotalTestSuites;
		fmData.tests_passed = json.tests.numPassedTests;
		fmData.tests_failed = json.tests.numFailedTests;
	} else {
		for (const snap of snapshots) {
			if (snap.label !== "Tests") continue;
			const t = fm(snap, "total");
			if (t > 0) fmData.total_tests = t;
		}
	}
}

export function promoteComplexity(fmData: Record<string, string | number | boolean>, snapshots: ReportSnapshot[], detailed: DetailedSources): void {
	const cf = detailed.complexityFunctions?.summary;
	if (cf) {
		fmData.max_complexity = cf.maxComplexity;
		fmData.avg_complexity = cf.avgComplexity;
		fmData.median_complexity = cf.medianComplexity;
		fmData.above_threshold_10 = cf.aboveThreshold10;
		fmData.above_threshold_15 = cf.aboveThreshold15;
	} else {
		for (const snap of snapshots) {
			if (snap.label !== "Complexity") continue;
			const mc = fm(snap, "max_complexity");
			if (mc > 0) fmData.max_complexity = mc;
		}
	}
}

export function promoteAggregates(fmData: Record<string, string | number | boolean>, detailed: DetailedSources): void {
	if (detailed.perFile.length === 0) return;
	const metrics = buildDomainMetrics(detailed);
	const totals = metrics.reduce(
		(acc, m) => {
			acc.loc += m.loc;
			acc.files += m.files;
			acc.fns += m.functions;
			acc.uncovFns += m.uncoveredFns;
			acc.dps += m.decisionPoints;
			return acc;
		},
		{ loc: 0, files: 0, fns: 0, uncovFns: 0, dps: 0 },
	);
	fmData.total_loc = totals.loc;
	fmData.total_files = totals.files;
	fmData.total_functions = totals.fns;
	fmData.uncovered_functions = totals.uncovFns;
	fmData.total_decision_points = totals.dps;
	fmData.domains = metrics.length;
}

export function promoteFrontmatter(
	snapshots: ReportSnapshot[],
	json: JsonDataSources,
	lint: LintResult | null,
	typedoc: TypeDocResult | null,
	detailed: DetailedSources,
): Record<string, string | number | boolean> {
	const fmData: Record<string, string | number | boolean> = {};
	promoteCoverage(fmData, snapshots, json);
	promoteTests(fmData, snapshots, json);
	promoteComplexity(fmData, snapshots, detailed);
	if (lint) {
		fmData.eslint_warnings = lint.warnings;
		fmData.eslint_errors = lint.errors;
	}
	if (typedoc) {
		fmData.typedoc_warnings = typedoc.warnings;
		fmData.typedoc_errors = typedoc.errors;
	}
	promoteAggregates(fmData, detailed);
	return fmData;
}

// ── Metrics Dictionary ───────────────────────────────────────────────

export const METRICS_DICTIONARY: Array<[string, string, string]> = [
	["total_tests", "Total number of test cases executed", "testreport.json"],
	["total_suites", "Total number of test suites", "testreport.json"],
	["tests_passed", "Number of tests with passing assertions", "testreport.json"],
	["tests_failed", "Number of tests with failing assertions", "testreport.json"],
	["tests_pending", "Number of skipped or pending tests", "testreport.json"],
	["test_success", "Overall pass/fail status of the test run", "testreport.json"],

	["coverage_lines_pct", "Percentage of executable statements exercised by tests", "coverage-final.json"],
	["coverage_branches_pct", "Percentage of branch paths (if/else, ternary) exercised", "coverage-final.json"],
	["coverage_functions_pct", "Percentage of declared functions called at least once", "coverage-final.json"],
	["coverage_statements_pct", "Statement coverage (≈ line coverage in Istanbul)", "coverage-final.json"],
	["coverage_files", "Number of source files included in coverage instrumentation", "coverage-final.json"],

	["total_loc", "Total non-blank lines of code across all source files", "coverage-final.json + source"],
	["total_files", "Number of source files with coverage data", "coverage-final.json"],
	["total_functions", "Total declared functions across all source files", "coverage-final.json"],
	["uncovered_functions", "Functions never called during test execution", "coverage-final.json"],

	["max_complexity", "Highest cyclomatic complexity of any single function", "complexity-functions.json"],
	["avg_complexity", "Mean cyclomatic complexity across all functions", "complexity-functions.json"],
	["median_complexity", "Median cyclomatic complexity across all functions", "complexity-functions.json"],
	["above_threshold_10", "Functions exceeding complexity 10 (warn level)", "complexity-functions.json"],
	["above_threshold_15", "Functions exceeding complexity 15 (hard cap)", "complexity-functions.json"],
	["total_decision_points", "Sum of cyclomatic decision points (if, for, &&, ||, ??, etc.)", "analysis.json"],
	["decision_point_count", "Per-file count of branching decisions", "analysis.json"],
	["decision_point_types", "Breakdown by type: if, else, ternary, case, for, while, catch, &&, ||, ??", "analysis.json"],

	["modules", "Number of TypeScript modules (files with exports)", "Codebase Report FM"],
	["classes", "Number of class declarations", "Codebase Report FM"],
	["interfaces", "Number of interface declarations", "Codebase Report FM"],
	["functions", "Number of exported function declarations", "Codebase Report FM"],

	["eslint_errors", "Number of ESLint rule violations at error severity", "eslint (live run)"],
	["eslint_warnings", "Number of ESLint rule violations at warning severity", "eslint (live run)"],
	["lint_rules_violated", "Breakdown of violated rules with occurrence counts", "eslint (live run)"],

	["typedoc_errors", "Number of TypeDoc errors found during documentation generation", "typedoc (live run)"],
	["typedoc_warnings", "Number of TypeDoc warnings found during documentation generation", "typedoc (live run)"],

	["domains", "Number of unique domain/infrastructure buckets in the codebase", "aggregated"],
	["domain_loc", "Lines of code per domain bucket", "aggregated"],
	["domain_coverage_pct", "Statement coverage percentage per domain", "aggregated"],
	["domain_decision_points", "Decision points per domain", "aggregated"],

	["startup_total_ms", "Total plugin startup duration in milliseconds", "Performance Report FM"],
	["startup_p95", "95th percentile startup time across recent measurements", "Performance Report FM"],
	["data_json_size_bytes", "Size of the persisted data.json file in bytes", "Performance Report FM"],

	["cycle", "Current development cycle number", "Cycle Report FM"],
	["pbis_delivered", "Product Backlog Items completed in the cycle", "Cycle Report FM"],
	["tests_added", "New tests written during the cycle", "Cycle Report FM"],

	["conformance", "Percentage of requirements with corresponding test coverage", "Trace Report FM"],

	["e2e_total", "Total end-to-end test cases", "E2E Report FM"],
	["e2e_passed", "Passing E2E tests", "E2E Report FM"],
	["e2e_failed", "Failing E2E tests", "E2E Report FM"],
];

export function renderMetricsDictionary(doc: Document): void {
	doc.heading(2, "Metrics Dictionary").addBlank();
	doc.quote("Reference of all metrics available from the reports pipeline.").addBlank();
	doc.table(
		["Metric", "Description", "Source"],
		METRICS_DICTIONARY.map(([metric, desc, source]) => [`\`${metric}\``, desc, source]),
	).addBlank();
}
