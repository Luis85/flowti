/**
 * summary-details.ts — Detail card renderers, top-files table, and warnings
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

// ── Warnings ─────────────────────────────────────────────────────────

function renderLintWarnings(doc: Document, lint: LintResult): void {
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
			lint.issues.map((i) => [`\`${i.file}\``, String(i.line), i.severity, i.message, i.rule]),
		).addBlank();
	}
}

function renderTypedocWarnings(doc: Document, typedoc: TypeDocResult): void {
	const summary = `TypeDoc: ${typedoc.errors} error(s), ${typedoc.warnings} warning(s)`;
	const lines = typedoc.issues.map((i) => `**${i.severity}** — ${i.message}`);
	doc.callout("warning", summary, lines).addBlank();
}

export function renderWarnings(doc: Document, lint: LintResult | null, typedoc: TypeDocResult | null): void {
	const hasLint = lint && (lint.errors > 0 || lint.warnings > 0);
	const hasTypedoc = typedoc && (typedoc.errors > 0 || typedoc.warnings > 0);
	if (!hasLint && !hasTypedoc) return;

	doc.heading(2, "Warnings").addBlank();
	if (hasLint) renderLintWarnings(doc, lint);
	if (hasTypedoc) renderTypedocWarnings(doc, typedoc);
}

// ── Top files by LOC ─────────────────────────────────────────────────

export function renderTopFilesByLoc(doc: Document, detailed: DetailedSources): void {
	if (detailed.perFile.length === 0) return;

	const sorted = [...detailed.perFile].sort((a, b) => b.loc - a.loc).slice(0, 10);
	if (sorted.length === 0) return;

	// Build a map of max complexity per file from complexity functions data
	const complexityMap = new Map<string, number>();
	if (detailed.complexityFunctions) {
		for (const fn of detailed.complexityFunctions.functions) {
			const rel = fn.file.replace(/.*Flowti CLI[\\/]/, "").replace(/\\/g, "/");
			const current = complexityMap.get(rel) ?? 0;
			if (fn.complexity > current) complexityMap.set(rel, fn.complexity);
		}
	}

	// Build a map of decision points per file
	const dpMap = new Map<string, number>();
	for (const f of detailed.topComplexFiles) {
		dpMap.set(f.file, f.decisionPointCount);
	}

	doc.heading(2, "Top 10 Files by LOC").addBlank();
	doc.table(
		["#", "File", "LOC", "Coverage %", "Max Complexity", "Decision Pts"],
		sorted.map((f, i) => [
			n(i + 1),
			`\`${f.file}\``,
			n(f.loc),
			`${f.stmtPct}%`,
			n(complexityMap.get(f.file) ?? 0),
			n(dpMap.get(f.file) ?? 0),
		]),
	).addBlank();
}

// ── Report domain details ────────────────────────────────────────────

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
