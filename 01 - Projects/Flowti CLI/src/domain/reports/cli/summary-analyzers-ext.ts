/**
 * summary-analyzers-ext.ts — Extended analyzers and dispatch for the summary report.
 *
 * Contains: performance, traceability, E2E, lint, typedoc analyzers
 * and the top-level analyzeReports dispatch function.
 */

import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type {
	ReportSnapshot,
	Finding,
	JsonDataSources,
	DetailedSources,
	LintResult,
	TypeDocResult,
} from "./summary-types.js";
import type { GeneratorResult } from "../report-runner.js";
import {
	fm,
	analyzeTests,
	analyzeCoverage,
	analyzeBuild,
	analyzeComplexity,
	analyzeCodebase,
	analyzeCycle,
} from "./summary-analyzers.js";
import { getRunResults } from "../run-context.js";
import { checkFreshness, resolveBuildPaths } from "../../build/build-freshness.js";

// ── Extended analyzers ──────────────────────────────────────────────

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

// ── Build freshness analyzer ─────────────────────────────────────────

export function analyzeBuildFreshness(projectPath: string): Finding[] {
	try {
		const { srcDir, binDir } = resolveBuildPaths(projectPath);
		const check = checkFreshness(srcDir, binDir);
		if (check.needsRebuild) {
			const details: string[] = [];
			if (check.added.length > 0) details.push(`${check.added.length} file(s) added`);
			if (check.modified.length > 0) details.push(`${check.modified.length} file(s) modified`);
			if (check.removed.length > 0) details.push(`${check.removed.length} file(s) removed`);
			return [{ category: "improvement", message: `Build is stale: ${check.reason}`, details }];
		}
		return [{ category: "positive", message: "Build is fresh — no rebuild needed." }];
	} catch {
		return [];
	}
}

// ── Generator run analyzer ──────────────────────────────────────────

/**
 * Analyze the current report generation run for failures and warnings.
 * Reads accumulated results from the run context (populated by report-runner).
 */
export function analyzeGeneratorRun(runResults?: readonly GeneratorResult[]): Finding[] {
	const results = runResults ?? getRunResults();
	if (results.length === 0) return [];

	const findings: Finding[] = [];
	const failed = results.filter((r) => !r.success);
	const warned = results.filter((r) => r.success && r.warnings && r.warnings.length > 0);

	if (failed.length > 0) {
		findings.push({
			category: "risk",
			message: `${failed.length} report generator(s) failed during this run:`,
			details: failed.map((r) => `**${r.label}** — ${r.error ?? "unknown error"}`),
		});
	}

	if (warned.length > 0) {
		const allWarnings: string[] = [];
		for (const r of warned) {
			for (const w of r.warnings!) {
				allWarnings.push(`**${r.label}**: ${w}`);
			}
		}
		findings.push({
			category: "improvement",
			message: `${allWarnings.length} warning(s) from report generators:`,
			details: allWarnings,
		});
	}

	const passed = results.filter((r) => r.success).length;
	if (passed > 0 && failed.length === 0) {
		findings.push({ category: "positive", message: `All ${passed} report generator(s) completed successfully.` });
	}

	return findings;
}

// ── Analysis dispatch ────────────────────────────────────────────────

type AnalyzerFn = (snap: ReportSnapshot, thresholds: Required<SummaryThresholds>, json: JsonDataSources, detailed: DetailedSources) => Finding[];

const ANALYZERS: Record<string, AnalyzerFn> = {
	Test: (snap, _t, json) => analyzeTests(snap, json),
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
	projectPath?: string,
): Finding[] {
	const findings: Finding[] = [];
	for (const snap of snapshots) {
		const analyzer = ANALYZERS[snap.label];
		if (analyzer) findings.push(...analyzer(snap, thresholds, json, detailed));
	}
	findings.push(...analyzeLint(lint, thresholds));
	findings.push(...analyzeTypedoc(typedoc, thresholds));
	if (projectPath) findings.push(...analyzeBuildFreshness(projectPath));
	findings.push(...analyzeGeneratorRun());
	return findings;
}
