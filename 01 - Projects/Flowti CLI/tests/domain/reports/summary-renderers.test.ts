import { describe, it, expect } from "vitest";
import { Document } from "../../../src/infrastructure/document.js";
import {
	classifyDomain,
	buildDomainMetrics,
	promoteCoverage,
	promoteTests,
	promoteComplexity,
	promoteAggregates,
	promoteFrontmatter,
	renderOverview,
	renderRisks,
	renderImprovements,
	renderWarnings,
	renderDomainMetrics,
	renderDomainDetails,
	renderMetricsDictionary,
	METRICS_DICTIONARY,
} from "../../../src/domain/reports/cli/summary-renderers.js";
import type {
	ReportSnapshot,
	JsonDataSources,
	DetailedSources,
	LintResult,
	Finding,
} from "../../../src/domain/reports/cli/summary-types.js";
import type { SummaryThresholds } from "../../../src/infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function snap(label: string, frontmatter: Record<string, string> = {}): ReportSnapshot {
	return { label, file: `${label.toLowerCase()}.md`, frontmatter };
}

const THRESHOLDS: Required<SummaryThresholds> = {
	coverageLines: 80,
	coverageBranches: 70,
	maxComplexity: 15,
	complexityAboveThresholdPct: 5,
	startupMs: 5000,
	eslintWarnings: 0,
	lintCommand: "npm run lint",
};

const EMPTY_JSON: JsonDataSources = {};
const EMPTY_DETAILED: DetailedSources = { perFile: [], topComplexFiles: [] };

function docString(fn: (doc: Document) => void): string {
	const doc = Document.create("test");
	fn(doc);
	return doc.toString();
}

// ── classifyDomain ───────────────────────────────────────────────────

describe("classifyDomain", () => {
	it("classifies domain paths", () => {
		expect(classifyDomain("src/domain/analytics/service.ts")).toBe("domain/analytics");
		expect(classifyDomain("src/domain/train/model.ts")).toBe("domain/train");
	});

	it("classifies infrastructure paths", () => {
		expect(classifyDomain("src/infrastructure/config.ts")).toBe("infrastructure");
	});

	it("classifies root paths", () => {
		expect(classifyDomain("src/main.ts")).toBe("root");
		expect(classifyDomain("other/file.ts")).toBe("root");
	});
});

// ── buildDomainMetrics ───────────────────────────────────────────────

describe("buildDomainMetrics", () => {
	it("returns empty array for no data", () => {
		expect(buildDomainMetrics(EMPTY_DETAILED)).toEqual([]);
	});

	it("aggregates per-file data into domains", () => {
		const detailed: DetailedSources = {
			perFile: [
				{ file: "src/domain/analytics/a.ts", loc: 100, stmtTotal: 80, stmtCovered: 60, stmtPct: 75, fnTotal: 10, fnUncovered: 2 },
				{ file: "src/domain/analytics/b.ts", loc: 50, stmtTotal: 40, stmtCovered: 30, stmtPct: 75, fnTotal: 5, fnUncovered: 1 },
				{ file: "src/infrastructure/config.ts", loc: 30, stmtTotal: 20, stmtCovered: 18, stmtPct: 90, fnTotal: 3, fnUncovered: 0 },
			],
			topComplexFiles: [
				{ file: "src/domain/analytics/a.ts", decisionPointCount: 15 },
			],
		};
		const metrics = buildDomainMetrics(detailed);
		expect(metrics).toHaveLength(2);

		const analytics = metrics.find((m) => m.domain === "domain/analytics")!;
		expect(analytics.files).toBe(2);
		expect(analytics.loc).toBe(150);
		expect(analytics.statements).toBe(120);
		expect(analytics.covered).toBe(90);
		expect(analytics.coveragePct).toBe(75);
		expect(analytics.functions).toBe(15);
		expect(analytics.uncoveredFns).toBe(3);
		expect(analytics.decisionPoints).toBe(15);

		const infra = metrics.find((m) => m.domain === "infrastructure")!;
		expect(infra.files).toBe(1);
		expect(infra.decisionPoints).toBe(0);
	});

	it("sorts by domain name", () => {
		const detailed: DetailedSources = {
			perFile: [
				{ file: "src/infrastructure/x.ts", loc: 10, stmtTotal: 5, stmtCovered: 5, stmtPct: 100, fnTotal: 1, fnUncovered: 0 },
				{ file: "src/domain/aaa/x.ts", loc: 10, stmtTotal: 5, stmtCovered: 5, stmtPct: 100, fnTotal: 1, fnUncovered: 0 },
			],
			topComplexFiles: [],
		};
		const metrics = buildDomainMetrics(detailed);
		expect(metrics[0].domain).toBe("domain/aaa");
		expect(metrics[1].domain).toBe("infrastructure");
	});

	it("handles zero statements for coverage percentage", () => {
		const detailed: DetailedSources = {
			perFile: [{ file: "src/domain/empty/x.ts", loc: 0, stmtTotal: 0, stmtCovered: 0, stmtPct: 0, fnTotal: 0, fnUncovered: 0 }],
			topComplexFiles: [],
		};
		const metrics = buildDomainMetrics(detailed);
		expect(metrics[0].coveragePct).toBe(0);
	});
});

// ── promoteCoverage ──────────────────────────────────────────────────

describe("promoteCoverage", () => {
	it("promotes from json.coverage when available", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const json: JsonDataSources = {
			coverage: { linesPct: 85, branchesPct: 72, functionsPct: 90, statementsPct: 84, filesCovered: 50 },
		};
		promoteCoverage(fmData, [], json);
		expect(fmData.coverage_lines_pct).toBe(85);
		expect(fmData.coverage_branches_pct).toBe(72);
		expect(fmData.coverage_functions_pct).toBe(90);
		expect(fmData.coverage_files).toBe(50);
	});

	it("falls back to frontmatter when no json", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const snapshots = [snap("Coverage", { lines_pct: "82", branches_pct: "70" })];
		promoteCoverage(fmData, snapshots, {});
		expect(fmData.coverage_lines_pct).toBe(82);
		expect(fmData.coverage_branches_pct).toBe(70);
	});

	it("skips zero values from frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const snapshots = [snap("Coverage", { lines_pct: "0" })];
		promoteCoverage(fmData, snapshots, {});
		expect(fmData.coverage_lines_pct).toBeUndefined();
	});
});

// ── promoteTests ─────────────────────────────────────────────────────

describe("promoteTests", () => {
	it("promotes from json.tests when available", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const json: JsonDataSources = {
			tests: { numTotalTests: 100, numPassedTests: 98, numFailedTests: 2, numPendingTests: 0, numTotalTestSuites: 10, numPassedTestSuites: 9, numFailedTestSuites: 1, success: false },
		};
		promoteTests(fmData, [], json);
		expect(fmData.total_tests).toBe(100);
		expect(fmData.total_suites).toBe(10);
		expect(fmData.tests_passed).toBe(98);
		expect(fmData.tests_failed).toBe(2);
	});

	it("falls back to frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		promoteTests(fmData, [snap("Tests", { total: "500" })], {});
		expect(fmData.total_tests).toBe(500);
	});

	it("skips zero total from frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		promoteTests(fmData, [snap("Tests", { total: "0" })], {});
		expect(fmData.total_tests).toBeUndefined();
	});
});

// ── promoteComplexity ────────────────────────────────────────────────

describe("promoteComplexity", () => {
	it("promotes from detailed complexity data", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const detailed: DetailedSources = {
			perFile: [],
			topComplexFiles: [],
			complexityFunctions: {
				summary: { totalFunctions: 100, maxComplexity: 18, avgComplexity: 3.5, medianComplexity: 2, totalComplexity: 350, aboveThreshold10: 5, aboveThreshold15: 2 },
				functions: [],
			},
		};
		promoteComplexity(fmData, [], detailed);
		expect(fmData.max_complexity).toBe(18);
		expect(fmData.avg_complexity).toBe(3.5);
		expect(fmData.above_threshold_10).toBe(5);
		expect(fmData.above_threshold_15).toBe(2);
	});

	it("falls back to frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		promoteComplexity(fmData, [snap("Complexity", { max_complexity: "12" })], EMPTY_DETAILED);
		expect(fmData.max_complexity).toBe(12);
	});

	it("skips zero from frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		promoteComplexity(fmData, [snap("Complexity", { max_complexity: "0" })], EMPTY_DETAILED);
		expect(fmData.max_complexity).toBeUndefined();
	});
});

// ── promoteAggregates ────────────────────────────────────────────────

describe("promoteAggregates", () => {
	it("skips when no perFile data", () => {
		const fmData: Record<string, string | number | boolean> = {};
		promoteAggregates(fmData, EMPTY_DETAILED);
		expect(Object.keys(fmData)).toHaveLength(0);
	});

	it("aggregates domain metrics into frontmatter", () => {
		const fmData: Record<string, string | number | boolean> = {};
		const detailed: DetailedSources = {
			perFile: [
				{ file: "src/domain/a/x.ts", loc: 100, stmtTotal: 50, stmtCovered: 40, stmtPct: 80, fnTotal: 10, fnUncovered: 2 },
				{ file: "src/domain/b/y.ts", loc: 200, stmtTotal: 100, stmtCovered: 80, stmtPct: 80, fnTotal: 20, fnUncovered: 5 },
			],
			topComplexFiles: [
				{ file: "src/domain/a/x.ts", decisionPointCount: 15 },
			],
		};
		promoteAggregates(fmData, detailed);
		expect(fmData.total_loc).toBe(300);
		expect(fmData.total_files).toBe(2);
		expect(fmData.total_functions).toBe(30);
		expect(fmData.uncovered_functions).toBe(7);
		expect(fmData.total_decision_points).toBe(15);
		expect(fmData.domains).toBe(2);
	});
});

// ── promoteFrontmatter (integration) ─────────────────────────────────

describe("promoteFrontmatter", () => {
	it("combines all promotions", () => {
		const json: JsonDataSources = {
			tests: { numTotalTests: 50, numPassedTests: 50, numFailedTests: 0, numPendingTests: 0, numTotalTestSuites: 5, numPassedTestSuites: 5, numFailedTestSuites: 0, success: true },
			coverage: { linesPct: 90, branchesPct: 80, functionsPct: 95, statementsPct: 89, filesCovered: 20 },
		};
		const lint: LintResult = { warnings: 3, errors: 0, breakdown: [], issues: [] };
		const result = promoteFrontmatter([], json, lint, EMPTY_DETAILED);
		expect(result.total_tests).toBe(50);
		expect(result.coverage_lines_pct).toBe(90);
		expect(result.eslint_warnings).toBe(3);
		expect(result.eslint_errors).toBe(0);
	});

	it("omits lint when null", () => {
		const result = promoteFrontmatter([], EMPTY_JSON, null, EMPTY_DETAILED);
		expect(result.eslint_warnings).toBeUndefined();
	});
});

// ── renderOverview ───────────────────────────────────────────────────

describe("renderOverview", () => {
	it("renders health KPIs from json data", () => {
		const json: JsonDataSources = {
			tests: { numTotalTests: 100, numPassedTests: 100, numFailedTests: 0, numPendingTests: 0, numTotalTestSuites: 10, numPassedTestSuites: 10, numFailedTestSuites: 0, success: true },
			coverage: { linesPct: 90, branchesPct: 80, functionsPct: 95, statementsPct: 89, filesCovered: 20 },
		};
		const findings: Finding[] = [
			{ category: "positive", message: "All good" },
			{ category: "improvement", message: "Could be better" },
		];
		const out = docString((doc) => renderOverview(doc, json, EMPTY_DETAILED, null, THRESHOLDS, findings));
		expect(out).toContain("## Overview");
		expect(out).toContain("100/100 passed");
		expect(out).toContain("90% lines");
		expect(out).toContain("0 risk(s)");
		expect(out).toContain("1 improvement(s)");
		expect(out).toContain("1 strength(s)");
		expect(out).toContain("Configured Thresholds");
	});

	it("includes lint KPI when provided", () => {
		const lint: LintResult = { warnings: 5, errors: 1, breakdown: [], issues: [] };
		const out = docString((doc) => renderOverview(doc, EMPTY_JSON, EMPTY_DETAILED, lint, THRESHOLDS, []));
		expect(out).toContain("1 errors");
		expect(out).toContain("5 warnings");
	});

	it("includes codebase KPI from perFile data", () => {
		const detailed: DetailedSources = {
			perFile: [{ file: "src/domain/a/x.ts", loc: 500, stmtTotal: 200, stmtCovered: 150, stmtPct: 75, fnTotal: 20, fnUncovered: 3 }],
			topComplexFiles: [],
		};
		const out = docString((doc) => renderOverview(doc, EMPTY_JSON, detailed, null, THRESHOLDS, []));
		expect(out).toContain("500 LOC");
		expect(out).toContain("1 files");
	});
});

// ── renderRisks ──────────────────────────────────────────────────────

describe("renderRisks", () => {
	it("renders risk findings", () => {
		const findings: Finding[] = [
			{ category: "risk", message: "Tests failing" },
			{ category: "risk", message: "Low coverage", details: ["file1.ts at 10%"] },
		];
		const out = docString((doc) => renderRisks(doc, findings));
		expect(out).toContain("## Risks");
		expect(out).toContain("Tests failing");
		expect(out).toContain("file1.ts at 10%");
	});

	it("renders nothing when no risks", () => {
		const out = docString((doc) => renderRisks(doc, [{ category: "positive", message: "ok" }]));
		expect(out).not.toContain("Risks");
	});
});

// ── renderImprovements ───────────────────────────────────────────────

describe("renderImprovements", () => {
	it("renders improvements and strengths", () => {
		const findings: Finding[] = [
			{ category: "improvement", message: "Refactor X" },
			{ category: "positive", message: "Tests solid" },
		];
		const out = docString((doc) => renderImprovements(doc, findings));
		expect(out).toContain("## Improvements");
		expect(out).toContain("Refactor X");
		expect(out).toContain("## Strengths");
		expect(out).toContain("Tests solid");
	});

	it("renders fallback when no findings at all", () => {
		const out = docString((doc) => renderImprovements(doc, []));
		expect(out).toContain("No actionable findings");
	});

	it("skips fallback when risks exist", () => {
		const out = docString((doc) => renderImprovements(doc, [{ category: "risk", message: "bad" }]));
		expect(out).not.toContain("No actionable findings");
	});
});

// ── renderWarnings ───────────────────────────────────────────────────

describe("renderWarnings", () => {
	it("renders nothing for null lint", () => {
		const out = docString((doc) => renderWarnings(doc, null));
		expect(out).not.toContain("Warnings");
	});

	it("renders nothing for clean lint", () => {
		const lint: LintResult = { warnings: 0, errors: 0, breakdown: [], issues: [] };
		const out = docString((doc) => renderWarnings(doc, lint));
		expect(out).not.toContain("Warnings");
	});

	it("renders breakdown and issues", () => {
		const lint: LintResult = {
			warnings: 2,
			errors: 1,
			breakdown: [{ rule: "no-unused-vars", count: 2 }, { rule: "no-any", count: 1 }],
			issues: [{ file: "src/a.ts", line: 10, col: 5, severity: "warning", message: "unused var", rule: "no-unused-vars" }],
		};
		const out = docString((doc) => renderWarnings(doc, lint));
		expect(out).toContain("## Warnings");
		expect(out).toContain("Lint Summary by Rule");
		expect(out).toContain("no-unused-vars");
		expect(out).toContain("All Lint Issues");
		expect(out).toContain("src/a.ts");
	});
});

// ── renderDomainMetrics ──────────────────────────────────────────────

describe("renderDomainMetrics", () => {
	it("renders nothing for empty data", () => {
		const out = docString((doc) => renderDomainMetrics(doc, EMPTY_DETAILED));
		expect(out).not.toContain("Domain Metrics");
	});

	it("renders domain table and totals", () => {
		const detailed: DetailedSources = {
			perFile: [
				{ file: "src/domain/a/x.ts", loc: 100, stmtTotal: 50, stmtCovered: 40, stmtPct: 80, fnTotal: 10, fnUncovered: 2 },
				{ file: "src/infrastructure/y.ts", loc: 50, stmtTotal: 30, stmtCovered: 25, stmtPct: 83, fnTotal: 5, fnUncovered: 1 },
			],
			topComplexFiles: [{ file: "src/domain/a/x.ts", decisionPointCount: 12 }],
		};
		const out = docString((doc) => renderDomainMetrics(doc, detailed));
		expect(out).toContain("## Domain Metrics");
		expect(out).toContain("domain/a");
		expect(out).toContain("infrastructure");
		expect(out).toContain("**Totals**");
		expect(out).toContain("150 LOC");
	});
});

// ── renderDomainDetails ──────────────────────────────────────────────

describe("renderDomainDetails", () => {
	it("renders test card from json", () => {
		const json: JsonDataSources = {
			tests: { numTotalTests: 50, numPassedTests: 50, numFailedTests: 0, numPendingTests: 0, numTotalTestSuites: 5, numPassedTestSuites: 5, numFailedTestSuites: 0, success: true },
		};
		const out = docString((doc) => renderDomainDetails(doc, [snap("Tests")], json, EMPTY_DETAILED));
		expect(out).toContain("### Tests");
		expect(out).toContain("total tests");
		expect(out).toContain("50");
	});

	it("renders coverage card from json", () => {
		const json: JsonDataSources = {
			coverage: { linesPct: 85, branchesPct: 72, functionsPct: 90, statementsPct: 84, filesCovered: 30 },
		};
		const out = docString((doc) => renderDomainDetails(doc, [snap("Coverage")], json, EMPTY_DETAILED));
		expect(out).toContain("### Coverage");
		expect(out).toContain("85%");
	});

	it("renders complexity card from detailed data", () => {
		const detailed: DetailedSources = {
			perFile: [],
			topComplexFiles: [{ file: "src/a.ts", decisionPointCount: 20 }],
			complexityFunctions: {
				summary: { totalFunctions: 50, maxComplexity: 12, avgComplexity: 3, medianComplexity: 2, totalComplexity: 150, aboveThreshold10: 2, aboveThreshold15: 0 },
				functions: [{ file: "src/a.ts", functionName: "doStuff", line: 5, complexity: 12 }],
			},
		};
		const out = docString((doc) => renderDomainDetails(doc, [snap("Complexity")], EMPTY_JSON, detailed));
		expect(out).toContain("### Complexity");
		expect(out).toContain("max complexity");
		expect(out).toContain("doStuff");
	});

	it("renders default card for unknown labels", () => {
		const out = docString((doc) => renderDomainDetails(doc, [snap("Build", { status: "success", duration: "12s" })], EMPTY_JSON, EMPTY_DETAILED));
		expect(out).toContain("### Build");
		expect(out).toContain("success");
		expect(out).toContain("12s");
	});
});

// ── renderMetricsDictionary ──────────────────────────────────────────

describe("renderMetricsDictionary", () => {
	it("renders a metrics table", () => {
		const out = docString((doc) => renderMetricsDictionary(doc));
		expect(out).toContain("## Metrics Dictionary");
		expect(out).toContain("total_tests");
		expect(out).toContain("coverage_lines_pct");
	});

	it("METRICS_DICTIONARY has entries", () => {
		expect(METRICS_DICTIONARY.length).toBeGreaterThan(30);
		for (const entry of METRICS_DICTIONARY) {
			expect(entry).toHaveLength(3);
			expect(entry[0].length).toBeGreaterThan(0);
		}
	});
});
