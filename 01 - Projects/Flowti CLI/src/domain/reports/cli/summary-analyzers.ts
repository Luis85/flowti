/**
 * summary-analyzers.ts — Per-report analysis functions for the summary report.
 *
 * Each analyzer inspects a ReportSnapshot (frontmatter) or JSON data
 * and returns findings categorized as risk, improvement, or positive.
 */

import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type {
	ReportSnapshot,
	Finding,
	JsonDataSources,
	DetailedSources,
	FileCoverageStats,
	LintResult,
	TypeDocResult,
} from "./summary-types.js";

// ── Frontmatter helpers ──────────────────────────────────────────────

export function fm(snap: ReportSnapshot, ...keys: string[]): number {
	for (const key of keys) {
		const val = snap.frontmatter[key];
		if (val !== undefined && val !== "") {
			const n = parseFloat(val);
			if (!isNaN(n)) return n;
		}
	}
	return 0;
}

export function fmStr(snap: ReportSnapshot, key: string): string {
	return snap.frontmatter[key] ?? "";
}

// ── Per-report analyzers ─────────────────────────────────────────────

export function analyzeTests(snap: ReportSnapshot, json: JsonDataSources): Finding[] {
	const findings: Finding[] = [];
	const total = json.tests ? json.tests.numTotalTests : fm(snap, "total");
	const passed = json.tests ? json.tests.numPassedTests : fm(snap, "passed");
	const failed = json.tests ? json.tests.numFailedTests : fm(snap, "failed");
	const suites = json.tests ? json.tests.numTotalTestSuites : fm(snap, "suites");
	const success = json.tests ? json.tests.success : fmStr(snap, "success") !== "false";

	if (total === 0) {
		findings.push({ category: "risk", message: "Test report shows 0 tests — test data may not have been collected." });
	} else if (failed > 0) {
		findings.push({ category: "risk", message: `${failed} test(s) failing out of ${total} total.` });
	} else {
		findings.push({ category: "positive", message: `All ${passed} tests passing across ${suites} suites.` });
	}

	if (!success && total > 0) {
		findings.push({ category: "risk", message: "Test suite reports overall FAILURE status." });
	}
	return findings;
}

export function checkLineCoverage(linesPct: number, thresholds: Required<SummaryThresholds>): Finding | null {
	if (linesPct <= 0) return null;
	if (linesPct < thresholds.coverageLines) {
		const gap = thresholds.coverageLines - linesPct;
		const category = linesPct < thresholds.coverageLines * 0.6 ? "risk" : "improvement";
		return { category, message: `Line coverage at ${linesPct}% — ${gap.toFixed(1)}pp below target of ${thresholds.coverageLines}%.` };
	}
	return { category: "positive", message: `Line coverage meets target at ${linesPct}% (threshold: ${thresholds.coverageLines}%).` };
}

export function checkZeroCoverage(perFile: FileCoverageStats[]): Finding | null {
	const zeroCov = perFile.filter((f) => f.stmtPct === 0 && f.stmtTotal > 5);
	if (zeroCov.length === 0) return null;
	const top = zeroCov.sort((a, b) => b.stmtTotal - a.stmtTotal).slice(0, 8);
	return {
		category: "improvement",
		message: `${zeroCov.length} source file(s) have zero test coverage — prioritize adding tests for the largest:`,
		details: top.map((f) => `\`${f.file}\` (${f.stmtTotal} statements, ${f.fnTotal} functions)`),
	};
}

export function checkLowCoverage(perFile: FileCoverageStats[]): Finding | null {
	const lowCov = perFile.filter((f) => f.stmtPct > 0 && f.stmtPct < 30).sort((a, b) => a.stmtPct - b.stmtPct);
	if (lowCov.length === 0) return null;
	const top = lowCov.slice(0, 5);
	return {
		category: "improvement",
		message: `${lowCov.length} source file(s) have coverage below 30% — quick wins for improvement:`,
		details: top.map((f) => `\`${f.file}\` at ${f.stmtPct}% (${f.stmtCovered}/${f.stmtTotal} statements)`),
	};
}

export function checkUncoveredFunctions(perFile: FileCoverageStats[]): Finding | null {
	const uncovFns = perFile.filter((f) => f.fnUncovered > 5).sort((a, b) => b.fnUncovered - a.fnUncovered);
	if (uncovFns.length === 0) return null;
	const top = uncovFns.slice(0, 5);
	return {
		category: "improvement",
		message: "Files with the most uncovered functions — add targeted unit tests:",
		details: top.map((f) => `\`${f.file}\` — ${f.fnUncovered}/${f.fnTotal} functions uncovered`),
	};
}

export function analyzeCoverage(snap: ReportSnapshot, thresholds: Required<SummaryThresholds>, json: JsonDataSources, detailed?: DetailedSources): Finding[] {
	const linesPct = json.coverage ? json.coverage.linesPct : fm(snap, "lines_pct", "lines", "line_coverage");
	const branchesPct = json.coverage ? json.coverage.branchesPct : fm(snap, "branches_pct", "branches", "branch_coverage");
	const functionsPct = json.coverage ? json.coverage.functionsPct : fm(snap, "functions_pct", "functions", "function_coverage");

	const findings: Finding[] = [];
	const lineResult = checkLineCoverage(linesPct, thresholds);
	if (lineResult) findings.push(lineResult);

	if (branchesPct > 0 && branchesPct < thresholds.coverageBranches) {
		findings.push({ category: "improvement",
			message: `Branch coverage at ${branchesPct}% — below target of ${thresholds.coverageBranches}%.` });
	}

	if (functionsPct > 0 && functionsPct < 60) {
		findings.push({ category: "improvement",
			message: `Function coverage at ${functionsPct}% — consider adding tests for uncovered functions.` });
	}

	if (detailed && detailed.perFile.length > 0) {
		const detailChecks = [
			checkZeroCoverage(detailed.perFile),
			checkLowCoverage(detailed.perFile),
			checkUncoveredFunctions(detailed.perFile),
		];
		for (const result of detailChecks) {
			if (result) findings.push(result);
		}
	}

	return findings;
}

export function analyzeBuild(snap: ReportSnapshot): Finding[] {
	const findings: Finding[] = [];
	const success = fmStr(snap, "success");
	const errors = fm(snap, "errors");
	const warnings = fm(snap, "warnings");
	const durationMs = fm(snap, "duration_ms");

	if (success === "false") {
		findings.push({ category: "risk", message: `Last build FAILED with ${errors} error(s).` });
	} else if (success === "true") {
		findings.push({ category: "positive", message: `Build succeeding (${(durationMs / 1000).toFixed(1)}s).` });
	}

	if (warnings > 5) {
		findings.push({ category: "improvement", message: `${warnings} build warnings — consider resolving.` });
	}
	return findings;
}

export function checkMaxComplexity(maxC: number, threshold: number): Finding | null {
	if (maxC <= 0) return null;
	if (maxC > threshold * 2) {
		return { category: "risk", message: `Maximum cyclomatic complexity is ${maxC} — far exceeds threshold of ${threshold}. Refactor the most complex functions.` };
	}
	if (maxC > threshold) {
		return { category: "improvement", message: `Maximum complexity at ${maxC} — exceeds threshold of ${threshold}.` };
	}
	return { category: "positive", message: `Maximum complexity at ${maxC} — within threshold of ${threshold}.` };
}

export function checkAboveThreshold(totalFunctions: number, aboveThreshold: number, targetPct: number): Finding | null {
	if (totalFunctions <= 0 || aboveThreshold <= 0) return null;
	const pct = (aboveThreshold / totalFunctions) * 100;
	if (pct > targetPct) {
		return { category: "improvement", message: `${aboveThreshold} functions (${pct.toFixed(1)}%) exceed complexity threshold of 10. Target: <${targetPct}%.` };
	}
	return null;
}

export function checkAvgComplexity(avgC: number, medianC: number): Finding | null {
	if (avgC <= 0) return null;
	return { category: avgC > 5 ? "improvement" : "positive", message: `Average complexity: ${avgC} (median: ${medianC || "?"}).` };
}

export function checkTopFunctions(detailed: DetailedSources): Finding | null {
	const fns = detailed.complexityFunctions?.functions;
	if (!fns || fns.length === 0) return null;
	const topFns = fns.slice(0, 7);
	return {
		category: "improvement",
		message: "Most complex functions — candidates for decomposition:",
		details: topFns.map((f) => `\`${f.file}:${f.line}\` — \`${f.functionName}\` (complexity ${f.complexity})`),
	};
}

export function checkDecisionPointDensity(detailed: DetailedSources): Finding | null {
	if (detailed.topComplexFiles.length === 0) return null;
	const top = detailed.topComplexFiles.slice(0, 7);
	return {
		category: "improvement",
		message: "Files with the highest decision-point density:",
		details: top.map((f) => `\`${f.file}\` — ${f.decisionPointCount} decision points`),
	};
}

interface ComplexityValues {
	maxC: number;
	avgC: number;
	medianC: number;
	totalFunctions: number;
	aboveThreshold: number;
}

export function resolveComplexityValues(snap: ReportSnapshot, detailed?: DetailedSources): ComplexityValues {
	const cf = detailed?.complexityFunctions?.summary;
	return {
		maxC: cf?.maxComplexity ?? fm(snap, "max_complexity"),
		avgC: cf?.avgComplexity ?? fm(snap, "avg_complexity", "average_complexity"),
		medianC: cf?.medianComplexity ?? fm(snap, "median_complexity"),
		totalFunctions: cf?.totalFunctions ?? fm(snap, "total_functions"),
		aboveThreshold: cf?.aboveThreshold10 ?? fm(snap, "above_threshold"),
	};
}

export function analyzeComplexity(snap: ReportSnapshot, thresholds: Required<SummaryThresholds>, detailed?: DetailedSources): Finding[] {
	const v = resolveComplexityValues(snap, detailed);
	const checks = [
		checkMaxComplexity(v.maxC, thresholds.maxComplexity),
		checkAboveThreshold(v.totalFunctions, v.aboveThreshold, thresholds.complexityAboveThresholdPct),
		checkAvgComplexity(v.avgC, v.medianC),
		detailed ? checkTopFunctions(detailed) : null,
		detailed ? checkDecisionPointDensity(detailed) : null,
	];
	return checks.filter((r): r is Finding => r !== null);
}

export function analyzeCodebase(snap: ReportSnapshot): Finding[] {
	const modules = fm(snap, "modules", "total_files", "files");
	const classes = fm(snap, "classes");
	const interfaces = fm(snap, "interfaces");
	const functions = fm(snap, "functions");

	const parts: string[] = [];
	if (modules > 0) parts.push(`${modules} modules`);
	if (classes > 0) parts.push(`${classes} classes`);
	if (interfaces > 0) parts.push(`${interfaces} interfaces`);
	if (functions > 0) parts.push(`${functions} functions`);

	if (parts.length > 0) {
		return [{ category: "positive", message: `Codebase: ${parts.join(", ")}.` }];
	}
	return [];
}

export function analyzeCycle(snap: ReportSnapshot): Finding[] {
	const cycle = fm(snap, "cycle");
	if (cycle <= 0) return [];
	const totalTests = fm(snap, "total_tests");
	const testsAdded = fm(snap, "tests_added");
	const totalSuites = fm(snap, "total_suites");
	const pbis = fm(snap, "pbis_delivered");
	const stage = fmStr(snap, "stage");

	return [{ category: "positive",
		message: `Cycle ${cycle} (${stage}): ${pbis} PBIs delivered, ${testsAdded} tests added. Total: ${totalTests} tests, ${totalSuites} suites.` }];
}

export function analyzePerformance(snap: ReportSnapshot, thresholds: Required<SummaryThresholds>): Finding[] {
	const findings: Finding[] = [];
	const startupMs = fm(snap, "startup_total_ms");
	const p95 = fm(snap, "startup_p95");
	const dataSize = fm(snap, "data_json_size_bytes");

	if (startupMs > 0) {
		if (p95 > thresholds.startupMs) {
			findings.push({ category: "improvement",
				message: `Startup p95 at ${(p95 / 1000).toFixed(1)}s — exceeds threshold of ${(thresholds.startupMs / 1000).toFixed(1)}s.` });
		} else {
			findings.push({ category: "positive",
				message: `Startup p95 at ${(p95 / 1000).toFixed(1)}s — within threshold.` });
		}
	}

	if (dataSize > 5 * 1024 * 1024) {
		findings.push({ category: "improvement", message: `data.json is ${(dataSize / (1024 * 1024)).toFixed(1)}MB — consider pruning old data.` });
	}
	return findings;
}

export function analyzeTraceability(snap: ReportSnapshot): Finding[] {
	const conformance = fm(snap, "conformance", "coverage");
	if (conformance <= 0) return [];
	if (conformance < 80) {
		return [{ category: "improvement", message: `Trace conformance at ${conformance}% — some requirements lack test coverage.` }];
	}
	if (conformance >= 90) {
		return [{ category: "positive", message: `Trace conformance strong at ${conformance}%.` }];
	}
	return [];
}

export function analyzeE2e(snap: ReportSnapshot): Finding[] {
	const total = fm(snap, "total_tests");
	const passed = fm(snap, "passed");
	const failed = fm(snap, "failed");

	if (failed > 0) {
		return [{ category: "risk", message: `${failed} E2E test(s) failing out of ${total}.` }];
	}
	if (total > 0) {
		return [{ category: "positive", message: `All ${passed} E2E tests passing (${total} total).` }];
	}
	return [];
}

export function analyzeLint(lint: LintResult | null, thresholds: Required<SummaryThresholds>): Finding[] {
	if (!lint) return [];
	const findings: Finding[] = [];
	if (lint.errors > 0) {
		const errorIssues = lint.issues.filter((i) => i.severity === "error");
		findings.push({
			category: "risk",
			message: `${lint.errors} eslint error(s) found — fix before merging:`,
			details: errorIssues.slice(0, 10).map((i) => `\`${i.file}:${i.line}\` — ${i.message} (${i.rule})`),
		});
	}
	if (lint.warnings > thresholds.eslintWarnings) {
		const warnIssues = lint.issues.filter((i) => i.severity === "warning");
		findings.push({
			category: "improvement",
			message: `${lint.warnings} eslint warning(s) — threshold is ${thresholds.eslintWarnings}:`,
			details: warnIssues.slice(0, 10).map((i) => `\`${i.file}:${i.line}\` — ${i.message} (${i.rule})`),
		});
	} else if (lint.warnings === 0 && lint.errors === 0) {
		findings.push({ category: "positive", message: "No eslint errors or warnings." });
	}
	return findings;
}

export function analyzeTypedoc(typedoc: TypeDocResult | null, thresholds: Required<SummaryThresholds>): Finding[] {
	if (!typedoc) return [];
	const findings: Finding[] = [];
	if (typedoc.errors > 0) {
		findings.push({
			category: "risk",
			message: `${typedoc.errors} TypeDoc error(s) found:`,
			details: typedoc.issues.filter((i) => i.severity === "error").slice(0, 10).map((i) => i.message),
		});
	}
	if (typedoc.warnings > thresholds.typedocWarnings) {
		findings.push({
			category: "improvement",
			message: `${typedoc.warnings} TypeDoc warning(s) — threshold is ${thresholds.typedocWarnings}:`,
			details: typedoc.issues.filter((i) => i.severity === "warning").slice(0, 10).map((i) => i.message),
		});
	} else if (typedoc.warnings === 0 && typedoc.errors === 0) {
		findings.push({ category: "positive", message: "No TypeDoc errors or warnings." });
	}
	return findings;
}

// ── Analysis dispatch ────────────────────────────────────────────────

type AnalyzerFn = (snap: ReportSnapshot, thresholds: Required<SummaryThresholds>, json: JsonDataSources, detailed: DetailedSources) => Finding[];

const ANALYZERS: Record<string, AnalyzerFn> = {
	Tests: (snap, _t, json) => analyzeTests(snap, json),
	Coverage: (snap, t, json, d) => analyzeCoverage(snap, t, json, d),
	Build: (snap) => analyzeBuild(snap),
	Complexity: (snap, t, _j, d) => analyzeComplexity(snap, t, d),
	Codebase: (snap) => analyzeCodebase(snap),
	Cycle: (snap) => analyzeCycle(snap),
	Performance: (snap, t) => analyzePerformance(snap, t),
	Traceability: (snap) => analyzeTraceability(snap),
	"E2E Tests": (snap) => analyzeE2e(snap),
};

export function analyzeReports(
	snapshots: ReportSnapshot[], thresholds: Required<SummaryThresholds>,
	lint: LintResult | null, typedoc: TypeDocResult | null,
	json: JsonDataSources, detailed: DetailedSources,
): Finding[] {
	const findings: Finding[] = [];
	for (const snap of snapshots) {
		const analyzer = ANALYZERS[snap.label];
		if (analyzer) findings.push(...analyzer(snap, thresholds, json, detailed));
	}
	findings.push(...analyzeLint(lint, thresholds));
	findings.push(...analyzeTypedoc(typedoc, thresholds));
	return findings;
}
