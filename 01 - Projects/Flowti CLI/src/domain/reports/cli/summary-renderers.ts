/**
 * summary-renderers.ts — Document rendering functions for the summary report.
 *
 * Each function appends a section to a Document instance.
 */

import type { Document } from "../../../infrastructure/document.js";
import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type {
	ReportSnapshot,
	Finding,
	JsonDataSources,
	DetailedSources,
	LintResult,
	DomainMetrics,
} from "./summary-types.js";
import { fm } from "./summary-analyzers.js";
import { n } from "./summary-formatters.js";

// ── Detail card renderers ────────────────────────────────────────────

const FM_SKIP = new Set(["type", "project", "date", "tags", "build_type", "schema_version", "node_version", "tools", "mode"]);

function renderTestCard(doc: Document, snap: ReportSnapshot, json: JsonDataSources): void {
	if (!json.tests) { renderDefaultCard(doc, snap); return; }
	const t = json.tests;
	doc.table(["Metric", "Value"], [
		["total tests", n(t.numTotalTests)],
		["passed", n(t.numPassedTests)],
		["failed", n(t.numFailedTests)],
		["pending", n(t.numPendingTests)],
		["suites", n(t.numTotalTestSuites)],
		["success", String(t.success)],
	]).addBlank();
	const perfKeys = ["startup_p50", "startup_p95", "startup_max", "startup_measurements", "data_json_size_bytes", "duration_ms"];
	const perfPairs = perfKeys
		.filter((k) => snap.frontmatter[k] !== undefined)
		.map((k) => [k.replace(/_/g, " "), snap.frontmatter[k]]);
	if (perfPairs.length > 0) {
		doc.table(["Perf Metric", "Value"], perfPairs).addBlank();
	}
}

function renderCoverageCard(doc: Document, json: JsonDataSources): void {
	const c = json.coverage!;
	doc.table(["Metric", "Value"], [
		["lines", `${c.linesPct}%`],
		["branches", `${c.branchesPct}%`],
		["functions", `${c.functionsPct}%`],
		["statements", `${c.statementsPct}%`],
		["files covered", n(c.filesCovered)],
	]).addBlank();
}

function renderDefaultCard(doc: Document, snap: ReportSnapshot): void {
	const pairs = Object.entries(snap.frontmatter).filter(([key]) => !FM_SKIP.has(key));
	if (pairs.length > 0) {
		doc.table(["Metric", "Value"], pairs.map(([key, value]) => [key.replace(/_/g, " "), value])).addBlank();
	}
}

function renderComplexityCard(doc: Document, snap: ReportSnapshot, detailed: DetailedSources): void {
	const cf = detailed.complexityFunctions;
	if (!cf) { renderDefaultCard(doc, snap); return; }
	const s = cf.summary;
	doc.table(["Metric", "Value"], [
		["total functions", n(s.totalFunctions)],
		["max complexity", n(s.maxComplexity)],
		["avg complexity", String(s.avgComplexity)],
		["median complexity", n(s.medianComplexity)],
		["above 10 (warn)", n(s.aboveThreshold10)],
		["above 15 (hard cap)", n(s.aboveThreshold15)],
		["total decision points", n(detailed.topComplexFiles.reduce((sum, f) => sum + f.decisionPointCount, 0))],
	]).addBlank();

	const topFns = cf.functions.slice(0, 10);
	if (topFns.length > 0) {
		doc.heading(4, "Top Functions by Complexity").addBlank();
		doc.table(
			["#", "Complexity", "Function", "File"],
			topFns.map((f, i) => [n(i + 1), n(f.complexity), `\`${f.functionName}\``, `\`${f.file}:${f.line}\``]),
		).addBlank();
	}
}

// ── Domain metrics ───────────────────────────────────────────────────

export function classifyDomain(filePath: string): string {
	const domainMatch = filePath.match(/^src\/domain\/([^/]+)\//);
	if (domainMatch) return `domain/${domainMatch[1]}`;
	if (filePath.startsWith("src/infrastructure/")) return "infrastructure";
	return "root";
}

export function buildDomainMetrics(detailed: DetailedSources): DomainMetrics[] {
	const map = new Map<string, { files: number; loc: number; stmts: number; covered: number; fns: number; uncovFns: number; dps: number }>();

	for (const f of detailed.perFile) {
		const domain = classifyDomain(f.file);
		const entry = map.get(domain) ?? { files: 0, loc: 0, stmts: 0, covered: 0, fns: 0, uncovFns: 0, dps: 0 };
		entry.files++;
		entry.loc += f.loc;
		entry.stmts += f.stmtTotal;
		entry.covered += f.stmtCovered;
		entry.fns += f.fnTotal;
		entry.uncovFns += f.fnUncovered;
		map.set(domain, entry);
	}

	for (const c of detailed.topComplexFiles) {
		const domain = classifyDomain(c.file);
		const entry = map.get(domain);
		if (entry) entry.dps += c.decisionPointCount;
	}

	const metrics: DomainMetrics[] = [];
	for (const [domain, e] of map.entries()) {
		metrics.push({
			domain,
			files: e.files,
			loc: e.loc,
			statements: e.stmts,
			covered: e.covered,
			coveragePct: e.stmts > 0 ? Math.round((e.covered / e.stmts) * 1000) / 10 : 0,
			functions: e.fns,
			uncoveredFns: e.uncovFns,
			decisionPoints: e.dps,
		});
	}

	return metrics.sort((a, b) => a.domain.localeCompare(b.domain));
}

export function renderDomainMetrics(doc: Document, detailed: DetailedSources): void {
	const metrics = buildDomainMetrics(detailed);
	if (metrics.length === 0) return;

	doc.heading(2, "Domain Metrics").addBlank();
	doc.table(
		["Domain", "Files", "LOC", "Stmts", "Covered", "Coverage %", "Functions", "Uncov. Fns", "Decision Pts"],
		metrics.map((m) => [
			m.domain,
			n(m.files),
			n(m.loc),
			n(m.statements),
			n(m.covered),
			`${m.coveragePct}%`,
			n(m.functions),
			n(m.uncoveredFns),
			n(m.decisionPoints),
		]),
	).addBlank();

	const totals = metrics.reduce(
		(acc, m) => {
			acc.files += m.files;
			acc.loc += m.loc;
			acc.stmts += m.statements;
			acc.covered += m.covered;
			acc.fns += m.functions;
			acc.uncovFns += m.uncoveredFns;
			acc.dps += m.decisionPoints;
			return acc;
		},
		{ files: 0, loc: 0, stmts: 0, covered: 0, fns: 0, uncovFns: 0, dps: 0 },
	);
	const totalPct = totals.stmts > 0 ? Math.round((totals.covered / totals.stmts) * 1000) / 10 : 0;
	doc.quote(
		`**Totals**: ${n(totals.files)} files, ${n(totals.loc)} LOC, ${n(totals.stmts)} statements, ${totalPct}% coverage, ${n(totals.fns)} functions (${n(totals.uncovFns)} uncovered), ${n(totals.dps)} decision points`,
	).addBlank();
}

// ── Section renderers ────────────────────────────────────────────────

export function parseDetailColumns(details: string[]): { headers: string[]; rows: string[][] } {
	const SEP = " — ";
	const hasSep = details.every((d) => d.includes(SEP));
	if (!hasSep) {
		return { headers: ["Detail"], rows: details.map((d) => [d]) };
	}
	const rows = details.map((d) => {
		const idx = d.indexOf(SEP);
		return [d.slice(0, idx), d.slice(idx + SEP.length)];
	});
	return { headers: ["File", "Info"], rows };
}

function flattenFindings(findings: Finding[]): string[] {
	const lines: string[] = [];
	for (const f of findings) {
		lines.push(f.message);
		if (f.details) {
			for (const d of f.details) {
				lines.push(`  - ${d}`);
			}
		}
	}
	return lines;
}

export function buildHealthKpis(
	json: JsonDataSources,
	detailed: DetailedSources,
	lint: LintResult | null,
	thresholds: Required<SummaryThresholds>,
): string[] {
	const kpis: string[] = [];

	if (json.tests) {
		const t = json.tests;
		const icon = t.numFailedTests > 0 ? "🔴" : "🟢";
		kpis.push(`${icon} **Tests**: ${n(t.numPassedTests)}/${n(t.numTotalTests)} passed (${n(t.numTotalTestSuites)} suites)`);
	}

	if (json.coverage) {
		const c = json.coverage;
		const icon = c.linesPct < thresholds.coverageLines ? "🟡" : "🟢";
		kpis.push(`${icon} **Coverage**: ${c.linesPct}% lines, ${c.branchesPct}% branches, ${c.functionsPct}% functions`);
	}

	const cf = detailed.complexityFunctions?.summary;
	if (cf) {
		const icon = cf.maxComplexity > thresholds.maxComplexity ? "🟡" : "🟢";
		kpis.push(`${icon} **Complexity**: max ${cf.maxComplexity}, avg ${cf.avgComplexity}, median ${cf.medianComplexity}`);
	}

	if (lint) {
		const icon = lint.errors > 0 ? "🔴" : lint.warnings > thresholds.eslintWarnings ? "🟡" : "🟢";
		kpis.push(`${icon} **Lint**: ${lint.errors} errors, ${lint.warnings} warnings`);
	}

	if (detailed.perFile.length > 0) {
		const metrics = buildDomainMetrics(detailed);
		const totals = metrics.reduce((acc, m) => { acc.loc += m.loc; acc.files += m.files; return acc; }, { loc: 0, files: 0 });
		kpis.push(`📊 **Codebase**: ${n(totals.loc)} LOC across ${n(totals.files)} files (${n(metrics.length)} domains)`);
	}

	return kpis;
}

export function renderOverview(
	doc: Document,
	json: JsonDataSources,
	detailed: DetailedSources,
	lint: LintResult | null,
	thresholds: Required<SummaryThresholds>,
	findings: Finding[],
): void {
	doc.heading(2, "Overview").addBlank();

	const kpis = buildHealthKpis(json, detailed, lint, thresholds);
	const risks = findings.filter((f) => f.category === "risk").length;
	const improvements = findings.filter((f) => f.category === "improvement").length;
	const positives = findings.filter((f) => f.category === "positive").length;

	if (kpis.length > 0) {
		doc.callout("info", "Health", kpis).addBlank();
	}

	doc.callout("abstract", "Findings", [
		`🔴 ${risks} risk(s) · 🟡 ${improvements} improvement(s) · 🟢 ${positives} strength(s)`,
	]).addBlank();

	doc.heading(3, "Configured Thresholds").addBlank();
	doc.table(
		["Metric", "Threshold"],
		[
			["Line coverage", `>= ${thresholds.coverageLines}%`],
			["Branch coverage", `>= ${thresholds.coverageBranches}%`],
			["Max complexity", `<= ${thresholds.maxComplexity}`],
			["Functions above threshold", `<= ${thresholds.complexityAboveThresholdPct}%`],
			["Startup p95", `<= ${thresholds.startupMs}ms`],
			["Eslint warnings", `<= ${thresholds.eslintWarnings}`],
		],
	).addBlank();
}

export function renderRisks(doc: Document, findings: Finding[]): void {
	const risks = findings.filter((f) => f.category === "risk");
	if (risks.length === 0) return;
	doc.heading(2, "Risks").addBlank();
	doc.callout("danger", "Requires attention", flattenFindings(risks)).addBlank();
}

export function renderImprovements(doc: Document, findings: Finding[]): void {
	const improvements = findings.filter((f) => f.category === "improvement");
	const positives = findings.filter((f) => f.category === "positive");

	if (improvements.length > 0) {
		doc.heading(2, "Improvements").addBlank();
		for (const imp of improvements) {
			doc.callout("tip", imp.message, []).addBlank();
			if (imp.details && imp.details.length > 0) {
				const { headers, rows } = parseDetailColumns(imp.details);
				doc.table(headers, rows).addBlank();
			}
		}
	}

	if (positives.length > 0) {
		doc.heading(2, "Strengths").addBlank();
		doc.callout("success", "What's working well", positives.map((f) => f.message)).addBlank();
	}

	if (improvements.length === 0 && positives.length === 0 && findings.filter((f) => f.category === "risk").length === 0) {
		doc.callout("info", "Analysis", ["No actionable findings from the available report data."]).addBlank();
	}
}

export function renderWarnings(doc: Document, lint: LintResult | null): void {
	if (!lint || (lint.errors === 0 && lint.warnings === 0)) return;

	doc.heading(2, "Warnings").addBlank();

	if (lint.breakdown.length > 0) {
		doc.heading(3, "Lint Summary by Rule").addBlank();
		doc.table(
			["Rule", "Count"],
			lint.breakdown.map((w) => [w.rule, String(w.count)]),
		).addBlank();
	}

	if (lint.issues.length > 0) {
		doc.heading(3, "All Lint Issues").addBlank();
		doc.table(
			["File", "Line", "Severity", "Message", "Rule"],
			lint.issues.map((i) => [
				`\`${i.file}\``,
				String(i.line),
				i.severity,
				i.message,
				i.rule,
			]),
		).addBlank();
	}
}

export function renderDomainDetails(doc: Document, snapshots: ReportSnapshot[], json: JsonDataSources, detailed: DetailedSources): void {
	doc.heading(2, "Report Details").addBlank();
	for (const snap of snapshots) {
		doc.heading(3, snap.label).addBlank();
		doc.quote(`Source: ${snap.file}`).addBlank();

		if (snap.label === "Tests" && json.tests) { renderTestCard(doc, snap, json); continue; }
		if (snap.label === "Coverage" && json.coverage) { renderCoverageCard(doc, json); continue; }
		if (snap.label === "Complexity" && detailed.complexityFunctions) { renderComplexityCard(doc, snap, detailed); continue; }
		renderDefaultCard(doc, snap);
	}
}

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
