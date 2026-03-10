/**
 * generate-summary-report.ts — Project Summary Report orchestrator.
 *
 * Loads data, runs analyzers, builds the document, and saves outputs.
 * All logic is delegated to the summary-* modules.
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { Document } from "../../../infrastructure/document.js";
import { RESET, GREEN, CYAN, DIM } from "../../../infrastructure/ui.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";
import type { SummaryThresholds } from "../../../infrastructure/types.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type {
	ReportSnapshot,
	Finding,
	JsonDataSources,
	DetailedSources,
	LintResult,
	TypeDocResult,
} from "./summary-types.js";
import { n, d } from "./summary-formatters.js";
import {
	resolveThresholds,
	discoverReports,
	loadJsonDataSources,
	loadDetailedSources,
	collectLintWarnings,
	collectTypedocWarnings,
} from "./summary-loaders.js";
import { analyzeReports } from "./summary-analyzers-ext.js";
import { getRunResults } from "../run-context.js";
import {
	promoteFrontmatter,
	renderOverview,
	renderRisks,
	renderImprovements,
	renderWarnings,
	renderDomainMetrics,
	renderTopFilesByLoc,
} from "./summary-renderers.js";

// ── Document builder ─────────────────────────────────────────────────

function buildSummaryReport(
	snapshots: ReportSnapshot[],
	findings: Finding[],
	lint: LintResult | null,
	typedoc: TypeDocResult | null,
	thresholds: Required<SummaryThresholds>,
	projectName: string,
	json: JsonDataSources,
	detailed: DetailedSources,
): Document {
	const now = clock.now();
	const risks = findings.filter((f) => f.category === "risk").length;
	const improvements = findings.filter((f) => f.category === "improvement").length;
	const positives = findings.filter((f) => f.category === "positive").length;

	const runResults = getRunResults();
	const generatorsFailed = runResults.filter((r) => !r.success).length;

	const fmData: Record<string, string | number | boolean> = {
		type: "ProjectSummary",
		project: projectName,
		date: now.toISOString(),
		reports_analyzed: snapshots.length,
		risks,
		improvements,
		positives,
		generators_run: runResults.length,
		generators_failed: generatorsFailed,
		...promoteFrontmatter(snapshots, json, lint, typedoc, detailed),
	};

	const doc = Document.create("Project Summary")
		.mergeFrontmatter(fmData)
		.addBlank()
		.heading(1, "Project Summary")
		.addBlank()
		.quote(`Generated: ${d(now)} | Reports analyzed: ${n(snapshots.length)}`)
		.addBlank();

	if (snapshots.length === 0) {
		doc.callout("warning", "No Reports", ["No reports found in the reports directory. Run report generators first."]).addBlank();
		return doc;
	}

	renderOverview(doc, json, detailed, lint, typedoc, thresholds, findings);
	renderGeneratorRun(doc);
	renderRisks(doc, findings);
	renderImprovements(doc, findings);
	renderWarnings(doc, lint, typedoc);
	renderDomainMetrics(doc, detailed);
	renderTopFilesByLoc(doc, detailed);

	// Wikilinks to baseline reports (details live there, not duplicated here)
	doc.heading(2, "Baseline Reports").addBlank();
	const reportLinks = snapshots.map((s) => `- [[${s.label} Report]]`);
	if (reportLinks.length > 0) {
		doc.text(reportLinks.join("\n")).addBlank();
	} else {
		doc.text("_No baseline reports found._").addBlank();
	}

	return doc;
}

// ── Generator run renderer ───────────────────────────────────────────

function renderGeneratorRun(doc: Document): void {
	const results = getRunResults();
	if (results.length === 0) return;

	const failed = results.filter((r) => !r.success);
	const warned = results.filter((r) => r.success && r.warnings && r.warnings.length > 0);
	const passed = results.filter((r) => r.success).length;

	doc.heading(2, "Generator Run").addBlank();

	if (failed.length > 0) {
		doc.callout("danger", `${failed.length} Generator(s) Failed`, failed.map((r) => {
			const dur = (r.durationMs / 1000).toFixed(1);
			return `**${r.label}** (${dur}s) — ${r.error ?? "unknown error"}`;
		})).addBlank();
	}

	if (warned.length > 0) {
		const warnLines: string[] = [];
		for (const r of warned) {
			for (const w of r.warnings!) {
				warnLines.push(`**${r.label}**: ${w}`);
			}
		}
		doc.callout("warning", "Generator Warnings", warnLines).addBlank();
	}

	doc.table(
		["Generator", "Status", "Duration"],
		results.map((r) => [
			r.label,
			r.success ? (r.warnings?.length ? "⚠ Warnings" : "✓ Passed") : "✗ Failed",
			`${(r.durationMs / 1000).toFixed(1)}s`,
		]),
	).addBlank();

	doc.quote(`**Total**: ${passed} passed, ${failed.length} failed, ${warned.length} with warnings`).addBlank();
}

// ── Entry point ──────────────────────────────────────────────────────

function logDataSources(snapshots: ReportSnapshot[], json: JsonDataSources, detailed: DetailedSources): void {
	const jsonLabels = [json.tests && "tests", json.coverage && "coverage"].filter(Boolean);
	log(`  ${DIM}Found ${snapshots.length} reports: ${snapshots.map((s) => s.label).join(", ")}${RESET}`);
	if (jsonLabels.length > 0) log(`  ${DIM}JSON sources: ${jsonLabels.join(", ")}${RESET}`);
	if (detailed.perFile.length > 0) log(`  ${DIM}Per-file coverage: ${detailed.perFile.length} files${RESET}`);
}

function runLintCheck(projectPath: string, command: string | undefined): LintResult | null {
	if (!command) return null;
	log(`  ${DIM}Running lint: ${command}${RESET}`);
	const result = collectLintWarnings(projectPath, command);
	log(`  ${DIM}Lint: ${result.errors} errors, ${result.warnings} warnings${RESET}`);
	return result;
}

function runTypedocCheck(projectPath: string, command: string | undefined): TypeDocResult | null {
	if (!command) return null;
	log(`  ${DIM}Running TypeDoc: ${command}${RESET}`);
	const result = collectTypedocWarnings(projectPath, command);
	log(`  ${DIM}TypeDoc: ${result.errors} errors, ${result.warnings} warnings${RESET}`);
	return result;
}

function categorizeFindingsBy(findings: Finding[], category: string): { message: string; details?: string[] }[] {
	return findings.filter((f) => f.category === category).map((f) => ({ message: f.message, details: f.details }));
}

function buildJsonOutput(
	projectName: string, snapshots: ReportSnapshot[], findings: Finding[],
	lint: LintResult | null, typedoc: TypeDocResult | null,
	thresholds: Required<SummaryThresholds>, json: JsonDataSources, detailed: DetailedSources,
): Record<string, unknown> {
	const risks = categorizeFindingsBy(findings, "risk");
	const improvements = categorizeFindingsBy(findings, "improvement");
	const positives = categorizeFindingsBy(findings, "positive");
	return {
		type: "ProjectSummary",
		project: projectName,
		date: clock.iso(),
		reportsAnalyzed: snapshots.length,
		summary: { risks: risks.length, improvements: improvements.length, positives: positives.length },
		metrics: promoteFrontmatter(snapshots, json, lint, typedoc, detailed),
		findings: { risks, improvements, positives },
		lint: lint ? { errors: lint.errors, warnings: lint.warnings, breakdown: lint.breakdown, issues: lint.issues } : null,
		typedoc: typedoc ? { errors: typedoc.errors, warnings: typedoc.warnings, issues: typedoc.issues } : null,
		thresholds,
		reports: snapshots.map((s) => ({ label: s.label, file: s.file, frontmatter: s.frontmatter })),
		jsonSources: { tests: json.tests ?? null, coverage: json.coverage ?? null },
		generatorRun: buildGeneratorRunJson(),
	};
}

function buildGeneratorRunJson(): Record<string, unknown> | null {
	const results = getRunResults();
	if (results.length === 0) return null;
	const passed = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success);
	return {
		total: results.length,
		passed,
		failed: failed.length,
		failures: failed.map((r) => ({ id: r.id, label: r.label, error: r.error ?? "unknown" })),
	};
}

function appendGeneratorRunWarnings(warnings: string[]): void {
	const results = getRunResults();
	const failed = results.filter((r) => !r.success);
	if (failed.length === 0) return;
	warnings.push(`${failed.length} generator(s) failed during this run:`);
	for (const r of failed) {
		warnings.push(`  ✗ ${r.label}: ${r.error ?? "unknown error"}`);
	}
}

function appendLintWarnings(warnings: string[], lint: LintResult | null): void {
	if (!lint || (lint.errors === 0 && lint.warnings === 0)) return;
	warnings.push(`Lint: ${lint.errors} error(s), ${lint.warnings} warning(s)`);
	for (const issue of lint.issues) {
		const icon = issue.severity === "error" ? "✗" : "⚠";
		warnings.push(`  ${icon} ${issue.file}:${issue.line} ${issue.message} (${issue.rule})`);
	}
}

function appendTypedocWarnings(warnings: string[], typedoc: TypeDocResult | null): void {
	if (!typedoc || (typedoc.errors === 0 && typedoc.warnings === 0)) return;
	warnings.push(`TypeDoc: ${typedoc.errors} error(s), ${typedoc.warnings} warning(s)`);
	for (const issue of typedoc.issues) {
		const icon = issue.severity === "error" ? "✗" : "⚠";
		warnings.push(`  ${icon} ${issue.message}`);
	}
}

function collectOutputWarnings(
	snapshots: ReportSnapshot[], risks: number,
	lint: LintResult | null, typedoc: TypeDocResult | null,
): string[] {
	const warnings: string[] = [];
	if (snapshots.length === 0) warnings.push("No reports found — run report generators first");
	if (risks > 0) warnings.push(`${risks} risk(s) detected`);
	appendGeneratorRunWarnings(warnings);
	appendLintWarnings(warnings, lint);
	appendTypedocWarnings(warnings, typedoc);
	return warnings;
}

export function generateSummaryReport(projectPath: string): GeneratorOutput {
	const svc = new ReportService(projectPath);
	const projectName = paths.basename(projectPath);
	const thresholds = resolveThresholds(projectPath);

	log(`\n  ${CYAN}▸${RESET} Generating Project Summary...\n`);

	const snapshots = discoverReports(svc.reportsDir);
	const json = loadJsonDataSources(svc.reportsDir);
	const detailed = loadDetailedSources(svc.reportsDir, projectPath);
	logDataSources(snapshots, json, detailed);

	const lint = runLintCheck(projectPath, thresholds.lintCommand);
	const typedoc = runTypedocCheck(projectPath, thresholds.typedocCommand);

	const findings = analyzeReports(snapshots, thresholds, lint, typedoc, json, detailed, projectPath);
	const doc = buildSummaryReport(snapshots, findings, lint, typedoc, thresholds, projectName, json, detailed);

	const stablePath = svc.stablePath("Project Summary.md");
	disk.mkdirSync(svc.reportsDir, { recursive: true });
	doc.save(stablePath);

	const summaryDir = svc.subdir("summary");
	disk.mkdirSync(summaryDir, { recursive: true });
	const safeTimestamp = clock.safeIso();
	const timestampedPath = paths.join(summaryDir, `${safeTimestamp}-project-summary.md`);
	doc.save(timestampedPath);

	const jsonData = buildJsonOutput(projectName, snapshots, findings, lint, typedoc, thresholds, json, detailed);
	const jsonPath = paths.join(summaryDir, `${safeTimestamp}-project-summary.json`);
	disk.writeFileSync(jsonPath, JSON.stringify(jsonData, null, "\t"), "utf-8");

	const risks = categorizeFindingsBy(findings, "risk").length;
	const improvements = categorizeFindingsBy(findings, "improvement").length;
	const positives = categorizeFindingsBy(findings, "positive").length;
	log(`\n  ${GREEN}✓${RESET} Project Summary: ${risks} risk(s), ${improvements} improvement(s), ${positives} strength(s)`);
	log(`    ${stablePath}`);
	log(`    ${timestampedPath}`);
	log(`    ${jsonPath}\n`);

	const warnings = collectOutputWarnings(snapshots, risks, lint, typedoc);

	return {
		success: true,
		outputPath: stablePath,
		metrics: { risks, improvements, positives, reportsAnalyzed: snapshots.length },
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}