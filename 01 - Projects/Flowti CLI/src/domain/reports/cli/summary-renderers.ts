/**
 * summary-renderers.ts — Document rendering functions for the summary report.
 *
 * Each function appends a section to a Document instance.
 */

import type { Document } from "../../../infrastructure/document.js";
import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type {
	Finding,
	JsonDataSources,
	DetailedSources,
	LintResult,
	TypeDocResult,
	DomainMetrics,
} from "./summary-types.js";
import { n } from "./summary-formatters.js";

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

function testKpi(json: JsonDataSources): string | null {
	if (!json.tests) return null;
	const t = json.tests;
	const icon = t.numFailedTests > 0 ? "🔴" : "🟢";
	return `${icon} **Tests**: ${n(t.numPassedTests)}/${n(t.numTotalTests)} passed (${n(t.numTotalTestSuites)} suites)`;
}

function coverageKpi(json: JsonDataSources, threshold: number): string | null {
	if (!json.coverage) return null;
	const c = json.coverage;
	const icon = c.linesPct < threshold ? "🟡" : "🟢";
	return `${icon} **Coverage**: ${c.linesPct}% lines, ${c.branchesPct}% branches, ${c.functionsPct}% functions`;
}

function complexityKpi(detailed: DetailedSources, threshold: number): string | null {
	const cf = detailed.complexityFunctions?.summary;
	if (!cf) return null;
	const icon = cf.maxComplexity > threshold ? "🟡" : "🟢";
	return `${icon} **Complexity**: max ${cf.maxComplexity}, avg ${cf.avgComplexity}, median ${cf.medianComplexity}`;
}

function lintKpi(lint: LintResult | null, warnThreshold: number): string | null {
	if (!lint) return null;
	const icon = lint.errors > 0 ? "🔴" : lint.warnings > warnThreshold ? "🟡" : "🟢";
	return `${icon} **Lint**: ${lint.errors} errors, ${lint.warnings} warnings`;
}

function typedocKpi(typedoc: TypeDocResult | null, warnThreshold: number): string | null {
	if (!typedoc) return null;
	const icon = typedoc.errors > 0 ? "🔴" : typedoc.warnings > warnThreshold ? "🟡" : "🟢";
	return `${icon} **TypeDoc**: ${typedoc.errors} errors, ${typedoc.warnings} warnings`;
}

function codebaseKpi(detailed: DetailedSources): string | null {
	if (detailed.perFile.length === 0) return null;
	const metrics = buildDomainMetrics(detailed);
	const totals = metrics.reduce((acc, m) => { acc.loc += m.loc; acc.files += m.files; return acc; }, { loc: 0, files: 0 });
	return `📊 **Codebase**: ${n(totals.loc)} LOC across ${n(totals.files)} files (${n(metrics.length)} domains)`;
}

export function buildHealthKpis(
	json: JsonDataSources,
	detailed: DetailedSources,
	lint: LintResult | null,
	typedoc: TypeDocResult | null,
	thresholds: Required<SummaryThresholds>,
): string[] {
	return [
		testKpi(json),
		coverageKpi(json, thresholds.coverageLines),
		complexityKpi(detailed, thresholds.maxComplexity),
		lintKpi(lint, thresholds.eslintWarnings),
		typedocKpi(typedoc, thresholds.typedocWarnings),
		codebaseKpi(detailed),
	].filter((k): k is string => k !== null);
}

export function renderOverview(
	doc: Document,
	json: JsonDataSources,
	detailed: DetailedSources,
	lint: LintResult | null,
	typedoc: TypeDocResult | null,
	thresholds: Required<SummaryThresholds>,
	findings: Finding[],
): void {
	doc.heading(2, "Overview").addBlank();

	const kpis = buildHealthKpis(json, detailed, lint, typedoc, thresholds);
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
			["TypeDoc warnings", `<= ${thresholds.typedocWarnings}`],
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

// ── Re-exports from summary-promotion ────────────────────────────────

export {
	promoteCoverage,
	promoteTests,
	promoteComplexity,
	promoteAggregates,
	promoteFrontmatter,
	METRICS_DICTIONARY,
	renderMetricsDictionary,
} from "./summary-promotion.js";

// ── Re-exports from summary-details ──────────────────────────────────

export {
	renderWarnings,
	renderTopFilesByLoc,
	renderDomainDetails,
} from "./summary-details.js";
