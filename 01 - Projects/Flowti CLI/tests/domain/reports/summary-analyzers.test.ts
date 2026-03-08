import { describe, it, expect } from "vitest";
import {
	fm,
	fmStr,
	analyzeTests,
	checkLineCoverage,
	analyzeCoverage,
	analyzeBuild,
	checkMaxComplexity,
	checkAboveThreshold,
	checkAvgComplexity,
	checkTopFunctions,
	checkDecisionPointDensity,
	resolveComplexityValues,
	analyzeComplexity,
	checkZeroCoverage,
	checkLowCoverage,
	checkUncoveredFunctions,
	analyzeCodebase,
	analyzeCycle,
	analyzePerformance,
	analyzeTraceability,
	analyzeE2e,
	analyzeLint,
	analyzeTypedoc,
	analyzeReports,
} from "../../../src/domain/reports/cli/summary-analyzers.js";
import type { ReportSnapshot, JsonDataSources, DetailedSources, LintResult, TypeDocResult } from "../../../src/domain/reports/cli/summary-types.js";
import type { SummaryThresholds } from "../../../src/infrastructure/types.js";

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
	typedocCommand: "npm run docs",
	typedocWarnings: 0,
};

const EMPTY_JSON: JsonDataSources = {};
const EMPTY_DETAILED: DetailedSources = { perFile: [], topComplexFiles: [] };

// ── fm / fmStr ──────────────────────────────────────────────────────

describe("fm", () => {
	it("returns numeric value for first matching key", () => {
		expect(fm(snap("X", { total: "42" }), "total")).toBe(42);
	});

	it("tries multiple keys and returns first match", () => {
		expect(fm(snap("X", { lines: "85" }), "lines_pct", "lines")).toBe(85);
	});

	it("returns 0 when no key matches", () => {
		expect(fm(snap("X", {}), "missing")).toBe(0);
	});

	it("returns 0 for non-numeric values", () => {
		expect(fm(snap("X", { total: "N/A" }), "total")).toBe(0);
	});

	it("skips empty string values", () => {
		expect(fm(snap("X", { total: "" }), "total")).toBe(0);
	});
});

describe("fmStr", () => {
	it("returns string value", () => {
		expect(fmStr(snap("X", { success: "true" }), "success")).toBe("true");
	});

	it("returns empty string for missing key", () => {
		expect(fmStr(snap("X", {}), "missing")).toBe("");
	});
});

// ── analyzeTests ────────────────────────────────────────────────────

describe("analyzeTests", () => {
	it("reports risk when 0 tests", () => {
		const findings = analyzeTests(snap("Tests", { total: "0" }), EMPTY_JSON);
		expect(findings[0].category).toBe("risk");
		expect(findings[0].message).toContain("0 tests");
	});

	it("reports risk when tests fail", () => {
		const findings = analyzeTests(snap("Tests", { total: "10", passed: "8", failed: "2" }), EMPTY_JSON);
		expect(findings[0].category).toBe("risk");
		expect(findings[0].message).toContain("2 test(s) failing");
	});

	it("reports positive when all pass", () => {
		const findings = analyzeTests(snap("Tests", { total: "50", passed: "50", failed: "0", suites: "5" }), EMPTY_JSON);
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("50 tests passing");
	});

	it("uses json data when available", () => {
		const json: JsonDataSources = {
			tests: { numTotalTests: 100, numPassedTests: 100, numFailedTests: 0, numPendingTests: 0, numTotalTestSuites: 10, numPassedTestSuites: 10, numFailedTestSuites: 0, success: true },
		};
		const findings = analyzeTests(snap("Tests"), json);
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("100 tests");
	});

	it("reports risk on overall failure status", () => {
		const json: JsonDataSources = {
			tests: { numTotalTests: 10, numPassedTests: 10, numFailedTests: 0, numPendingTests: 0, numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0, success: false },
		};
		const findings = analyzeTests(snap("Tests"), json);
		expect(findings.some((f) => f.message.includes("FAILURE"))).toBe(true);
	});
});

// ── checkLineCoverage ───────────────────────────────────────────────

describe("checkLineCoverage", () => {
	it("returns null for 0 coverage", () => {
		expect(checkLineCoverage(0, THRESHOLDS)).toBeNull();
	});

	it("returns risk for very low coverage", () => {
		const result = checkLineCoverage(10, THRESHOLDS);
		expect(result!.category).toBe("risk");
	});

	it("returns improvement for moderate coverage below target", () => {
		const result = checkLineCoverage(60, THRESHOLDS);
		expect(result!.category).toBe("improvement");
	});

	it("returns positive when at or above target", () => {
		const result = checkLineCoverage(85, THRESHOLDS);
		expect(result!.category).toBe("positive");
	});
});

// ── analyzeCoverage ─────────────────────────────────────────────────

describe("analyzeCoverage", () => {
	it("reports branch coverage below target", () => {
		const json: JsonDataSources = {
			coverage: { linesPct: 85, branchesPct: 50, functionsPct: 80, statementsPct: 85, filesCovered: 10 },
		};
		const findings = analyzeCoverage(snap("Coverage"), THRESHOLDS, json);
		expect(findings.some((f) => f.message.includes("Branch coverage"))).toBe(true);
	});

	it("reports low function coverage", () => {
		const json: JsonDataSources = {
			coverage: { linesPct: 85, branchesPct: 80, functionsPct: 30, statementsPct: 85, filesCovered: 10 },
		};
		const findings = analyzeCoverage(snap("Coverage"), THRESHOLDS, json);
		expect(findings.some((f) => f.message.includes("Function coverage"))).toBe(true);
	});

	it("reports zero-coverage files from detailed data", () => {
		const detailed: DetailedSources = {
			perFile: [
				{ file: "src/a.ts", loc: 100, stmtTotal: 50, stmtCovered: 0, stmtPct: 0, fnTotal: 5, fnUncovered: 5 },
			],
			topComplexFiles: [],
		};
		const findings = analyzeCoverage(snap("Coverage"), THRESHOLDS, EMPTY_JSON, detailed);
		expect(findings.some((f) => f.message.includes("zero test coverage"))).toBe(true);
	});
});

// ── analyzeBuild ────────────────────────────────────────────────────

describe("analyzeBuild", () => {
	it("reports risk on failed build", () => {
		const findings = analyzeBuild(snap("Build", { success: "false", errors: "3" }));
		expect(findings[0].category).toBe("risk");
		expect(findings[0].message).toContain("FAILED");
	});

	it("reports positive on success", () => {
		const findings = analyzeBuild(snap("Build", { success: "true", duration_ms: "1500" }));
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("1.5s");
	});

	it("reports improvement for many warnings", () => {
		const findings = analyzeBuild(snap("Build", { success: "true", warnings: "10", duration_ms: "500" }));
		expect(findings.some((f) => f.message.includes("10 build warnings"))).toBe(true);
	});

	it("ignores low warning count", () => {
		const findings = analyzeBuild(snap("Build", { success: "true", warnings: "3", duration_ms: "500" }));
		expect(findings.every((f) => !f.message.includes("warnings"))).toBe(true);
	});
});

// ── checkMaxComplexity ──────────────────────────────────────────────

describe("checkMaxComplexity", () => {
	it("returns null for 0", () => {
		expect(checkMaxComplexity(0, 15)).toBeNull();
	});

	it("returns risk for far exceeded threshold", () => {
		const result = checkMaxComplexity(35, 15);
		expect(result!.category).toBe("risk");
	});

	it("returns improvement for exceeded threshold", () => {
		const result = checkMaxComplexity(20, 15);
		expect(result!.category).toBe("improvement");
	});

	it("returns positive within threshold", () => {
		const result = checkMaxComplexity(10, 15);
		expect(result!.category).toBe("positive");
	});
});

// ── checkAboveThreshold ─────────────────────────────────────────────

describe("checkAboveThreshold", () => {
	it("returns null when no functions", () => {
		expect(checkAboveThreshold(0, 0, 5)).toBeNull();
	});

	it("returns null when no functions above threshold", () => {
		expect(checkAboveThreshold(100, 0, 5)).toBeNull();
	});

	it("returns improvement when percentage exceeds target", () => {
		const result = checkAboveThreshold(100, 10, 5);
		expect(result!.category).toBe("improvement");
		expect(result!.message).toContain("10.0%");
	});

	it("returns null when percentage is within target", () => {
		expect(checkAboveThreshold(100, 3, 5)).toBeNull();
	});
});

// ── checkAvgComplexity ──────────────────────────────────────────────

describe("checkAvgComplexity", () => {
	it("returns null for 0", () => {
		expect(checkAvgComplexity(0, 0)).toBeNull();
	});

	it("returns positive for low avg", () => {
		const result = checkAvgComplexity(3, 2);
		expect(result!.category).toBe("positive");
	});

	it("returns improvement for high avg", () => {
		const result = checkAvgComplexity(7, 5);
		expect(result!.category).toBe("improvement");
	});
});

// ── analyzeComplexity (integration) ─────────────────────────────────

describe("analyzeComplexity", () => {
	it("works with frontmatter only", () => {
		const findings = analyzeComplexity(snap("Complexity", { max_complexity: "20", avg_complexity: "3", median_complexity: "2" }), THRESHOLDS);
		expect(findings.length).toBeGreaterThanOrEqual(2);
		expect(findings[0].message).toContain("20");
	});

	it("uses detailed data when available", () => {
		const detailed: DetailedSources = {
			perFile: [],
			topComplexFiles: [{ file: "src/a.ts", decisionPointCount: 50 }],
			complexityFunctions: {
				summary: { totalFunctions: 100, maxComplexity: 35, avgComplexity: 3, medianComplexity: 2, totalComplexity: 300, aboveThreshold10: 8, aboveThreshold15: 3 },
				functions: [{ file: "src/a.ts", functionName: "foo", line: 10, complexity: 35 }],
			},
		};
		const findings = analyzeComplexity(snap("Complexity"), THRESHOLDS, detailed);
		expect(findings.some((f) => f.message.includes("far exceeds"))).toBe(true);
		expect(findings.some((f) => f.message.includes("candidates for decomposition"))).toBe(true);
		expect(findings.some((f) => f.message.includes("decision-point density"))).toBe(true);
	});
});

// ── resolveComplexityValues ───────────────────────────────────────────

describe("resolveComplexityValues", () => {
	it("uses detailed data when available", () => {
		const detailed: DetailedSources = {
			perFile: [],
			topComplexFiles: [],
			complexityFunctions: {
				summary: { totalFunctions: 100, maxComplexity: 25, avgComplexity: 4, medianComplexity: 3, totalComplexity: 400, aboveThreshold10: 8, aboveThreshold15: 2 },
				functions: [],
			},
		};
		const v = resolveComplexityValues(snap("Complexity"), detailed);
		expect(v.maxC).toBe(25);
		expect(v.avgC).toBe(4);
		expect(v.totalFunctions).toBe(100);
		expect(v.aboveThreshold).toBe(8);
	});

	it("falls back to frontmatter when no detailed data", () => {
		const v = resolveComplexityValues(snap("Complexity", { max_complexity: "15", avg_complexity: "3", median_complexity: "2", total_functions: "50", above_threshold: "5" }));
		expect(v.maxC).toBe(15);
		expect(v.avgC).toBe(3);
		expect(v.medianC).toBe(2);
		expect(v.totalFunctions).toBe(50);
		expect(v.aboveThreshold).toBe(5);
	});
});

// ── checkTopFunctions ────────────────────────────────────────────────

describe("checkTopFunctions", () => {
	it("returns null when no complexity data", () => {
		expect(checkTopFunctions({ perFile: [], topComplexFiles: [] })).toBeNull();
	});

	it("returns finding with top functions", () => {
		const detailed: DetailedSources = {
			perFile: [],
			topComplexFiles: [],
			complexityFunctions: {
				summary: { totalFunctions: 10, maxComplexity: 20, avgComplexity: 5, medianComplexity: 3, totalComplexity: 50, aboveThreshold10: 2, aboveThreshold15: 1 },
				functions: [{ file: "src/a.ts", functionName: "foo", line: 10, complexity: 20 }],
			},
		};
		const result = checkTopFunctions(detailed)!;
		expect(result.category).toBe("improvement");
		expect(result.message).toContain("candidates for decomposition");
		expect(result.details![0]).toContain("foo");
	});
});

// ── checkDecisionPointDensity ────────────────────────────────────────

describe("checkDecisionPointDensity", () => {
	it("returns null when no files", () => {
		expect(checkDecisionPointDensity({ perFile: [], topComplexFiles: [] })).toBeNull();
	});

	it("returns finding with top files", () => {
		const result = checkDecisionPointDensity({ perFile: [], topComplexFiles: [{ file: "src/big.ts", decisionPointCount: 100 }] })!;
		expect(result.category).toBe("improvement");
		expect(result.details![0]).toContain("100 decision points");
	});
});

// ── checkZeroCoverage ────────────────────────────────────────────────

describe("checkZeroCoverage", () => {
	it("returns null when no zero-coverage files", () => {
		expect(checkZeroCoverage([{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 50, stmtPct: 100, fnTotal: 5, fnUncovered: 0 }])).toBeNull();
	});

	it("returns finding for zero-coverage files with >5 statements", () => {
		const result = checkZeroCoverage([
			{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 0, stmtPct: 0, fnTotal: 5, fnUncovered: 5 },
			{ file: "b.ts", loc: 10, stmtTotal: 3, stmtCovered: 0, stmtPct: 0, fnTotal: 1, fnUncovered: 1 },
		])!;
		expect(result.category).toBe("improvement");
		expect(result.message).toContain("1 source file(s)");
		expect(result.details![0]).toContain("a.ts");
	});
});

// ── checkLowCoverage ─────────────────────────────────────────────────

describe("checkLowCoverage", () => {
	it("returns null when no low-coverage files", () => {
		expect(checkLowCoverage([{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 50, stmtPct: 100, fnTotal: 5, fnUncovered: 0 }])).toBeNull();
	});

	it("returns finding for files below 30%", () => {
		const result = checkLowCoverage([
			{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 10, stmtPct: 20, fnTotal: 5, fnUncovered: 4 },
		])!;
		expect(result.category).toBe("improvement");
		expect(result.message).toContain("coverage below 30%");
		expect(result.details![0]).toContain("20%");
	});
});

// ── checkUncoveredFunctions ──────────────────────────────────────────

describe("checkUncoveredFunctions", () => {
	it("returns null when few uncovered functions", () => {
		expect(checkUncoveredFunctions([{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 50, stmtPct: 100, fnTotal: 5, fnUncovered: 2 }])).toBeNull();
	});

	it("returns finding for files with >5 uncovered functions", () => {
		const result = checkUncoveredFunctions([
			{ file: "a.ts", loc: 100, stmtTotal: 50, stmtCovered: 10, stmtPct: 20, fnTotal: 20, fnUncovered: 15 },
		])!;
		expect(result.category).toBe("improvement");
		expect(result.details![0]).toContain("15/20 functions uncovered");
	});
});

// ── analyzeCodebase ─────────────────────────────────────────────────

describe("analyzeCodebase", () => {
	it("reports codebase stats", () => {
		const findings = analyzeCodebase(snap("Codebase", { modules: "50", classes: "5", interfaces: "20", functions: "100" }));
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("50 modules");
	});

	it("returns empty for no data", () => {
		expect(analyzeCodebase(snap("Codebase"))).toEqual([]);
	});
});

// ── analyzeCycle ────────────────────────────────────────────────────

describe("analyzeCycle", () => {
	it("returns cycle summary", () => {
		const findings = analyzeCycle(snap("Cycle", { cycle: "5", stage: "active", pbis_delivered: "3", tests_added: "10", total_tests: "200", total_suites: "30" }));
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("Cycle 5");
	});

	it("returns empty when no cycle", () => {
		expect(analyzeCycle(snap("Cycle"))).toEqual([]);
	});
});

// ── analyzePerformance ──────────────────────────────────────────────

describe("analyzePerformance", () => {
	it("reports improvement for slow startup", () => {
		const findings = analyzePerformance(snap("Performance", { startup_total_ms: "1000", startup_p95: "6000" }), THRESHOLDS);
		expect(findings[0].category).toBe("improvement");
	});

	it("reports positive for fast startup", () => {
		const findings = analyzePerformance(snap("Performance", { startup_total_ms: "1000", startup_p95: "3000" }), THRESHOLDS);
		expect(findings[0].category).toBe("positive");
	});

	it("reports large data.json", () => {
		const size = 10 * 1024 * 1024;
		const findings = analyzePerformance(snap("Performance", { data_json_size_bytes: String(size) }), THRESHOLDS);
		expect(findings.some((f) => f.message.includes("data.json"))).toBe(true);
	});

	it("returns empty when no perf data", () => {
		expect(analyzePerformance(snap("Performance"), THRESHOLDS)).toEqual([]);
	});
});

// ── analyzeTraceability ─────────────────────────────────────────────

describe("analyzeTraceability", () => {
	it("reports improvement for low conformance", () => {
		const findings = analyzeTraceability(snap("Traceability", { conformance: "60" }));
		expect(findings[0].category).toBe("improvement");
	});

	it("reports positive for high conformance", () => {
		const findings = analyzeTraceability(snap("Traceability", { conformance: "95" }));
		expect(findings[0].category).toBe("positive");
	});

	it("returns empty for no data", () => {
		expect(analyzeTraceability(snap("Traceability"))).toEqual([]);
	});

	it("returns empty for mid-range conformance", () => {
		expect(analyzeTraceability(snap("Traceability", { conformance: "85" }))).toEqual([]);
	});
});

// ── analyzeE2e ──────────────────────────────────────────────────────

describe("analyzeE2e", () => {
	it("reports risk on failures", () => {
		const findings = analyzeE2e(snap("E2E Tests", { total_tests: "10", passed: "8", failed: "2" }));
		expect(findings[0].category).toBe("risk");
	});

	it("reports positive when all pass", () => {
		const findings = analyzeE2e(snap("E2E Tests", { total_tests: "10", passed: "10", failed: "0" }));
		expect(findings[0].category).toBe("positive");
	});

	it("returns empty when no tests", () => {
		expect(analyzeE2e(snap("E2E Tests"))).toEqual([]);
	});
});

// ── analyzeLint ─────────────────────────────────────────────────────

describe("analyzeLint", () => {
	it("returns empty for null lint", () => {
		expect(analyzeLint(null, THRESHOLDS)).toEqual([]);
	});

	it("reports risk on errors", () => {
		const lint: LintResult = {
			errors: 2, warnings: 0, breakdown: [],
			issues: [
				{ file: "a.ts", line: 1, col: 1, severity: "error", message: "err", rule: "no-unused-vars" },
				{ file: "b.ts", line: 2, col: 1, severity: "error", message: "err", rule: "no-unused-vars" },
			],
		};
		const findings = analyzeLint(lint, THRESHOLDS);
		expect(findings[0].category).toBe("risk");
		expect(findings[0].details).toHaveLength(2);
	});

	it("reports improvement on warnings above threshold", () => {
		const lint: LintResult = {
			errors: 0, warnings: 5, breakdown: [],
			issues: [{ file: "a.ts", line: 1, col: 1, severity: "warning", message: "warn", rule: "no-console" }],
		};
		const findings = analyzeLint(lint, THRESHOLDS);
		expect(findings[0].category).toBe("improvement");
	});

	it("reports positive when clean", () => {
		const lint: LintResult = { errors: 0, warnings: 0, breakdown: [], issues: [] };
		const findings = analyzeLint(lint, THRESHOLDS);
		expect(findings[0].category).toBe("positive");
	});
});

// ── analyzeTypedoc ──────────────────────────────────────────────────

describe("analyzeTypedoc", () => {
	it("returns empty for null input", () => {
		expect(analyzeTypedoc(null, THRESHOLDS)).toEqual([]);
	});

	it("reports risk for errors", () => {
		const td: TypeDocResult = { errors: 2, warnings: 0, issues: [
			{ severity: "error", message: "Cannot resolve module" },
			{ severity: "error", message: "Missing export" },
		] };
		const findings = analyzeTypedoc(td, THRESHOLDS);
		expect(findings[0].category).toBe("risk");
		expect(findings[0].message).toContain("2 TypeDoc error(s)");
		expect(findings[0].details).toHaveLength(2);
	});

	it("reports improvement for warnings above threshold", () => {
		const td: TypeDocResult = { errors: 0, warnings: 3, issues: [
			{ severity: "warning", message: "Unused type A" },
			{ severity: "warning", message: "Unused type B" },
			{ severity: "warning", message: "Unused type C" },
		] };
		const findings = analyzeTypedoc(td, THRESHOLDS);
		expect(findings[0].category).toBe("improvement");
		expect(findings[0].message).toContain("3 TypeDoc warning(s)");
	});

	it("reports positive when clean", () => {
		const td: TypeDocResult = { errors: 0, warnings: 0, issues: [] };
		const findings = analyzeTypedoc(td, THRESHOLDS);
		expect(findings[0].category).toBe("positive");
		expect(findings[0].message).toContain("No TypeDoc errors or warnings");
	});
});

// ── analyzeReports (dispatch) ───────────────────────────────────────

describe("analyzeReports", () => {
	it("dispatches to correct analyzers", () => {
		const snapshots: ReportSnapshot[] = [
			snap("Tests", { total: "50", passed: "50", failed: "0", suites: "5" }),
			snap("Build", { success: "true", duration_ms: "1000" }),
		];
		const findings = analyzeReports(snapshots, THRESHOLDS, null, null, EMPTY_JSON, EMPTY_DETAILED);
		expect(findings.length).toBeGreaterThanOrEqual(2);
	});

	it("includes lint findings", () => {
		const lint: LintResult = { errors: 0, warnings: 0, breakdown: [], issues: [] };
		const findings = analyzeReports([], THRESHOLDS, lint, null, EMPTY_JSON, EMPTY_DETAILED);
		expect(findings.some((f) => f.message.includes("No eslint"))).toBe(true);
	});

	it("skips unknown report labels", () => {
		const snapshots: ReportSnapshot[] = [snap("UnknownReport", { foo: "bar" })];
		const findings = analyzeReports(snapshots, THRESHOLDS, null, null, EMPTY_JSON, EMPTY_DETAILED);
		expect(findings).toEqual([]);
	});
});
