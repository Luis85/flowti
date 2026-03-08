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
import { analyzeReports } from "./summary-analyzers.js";
import {
	promoteFrontmatter,
	renderOverview,
	renderRisks,
	renderImprovements,
	renderWarnings,
	renderDomainMetrics,
	renderTopFilesByLoc,
	renderDomainDetails,
	renderMetricsDictionary,
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

	const fmData: Record<string, string | number | boolean> = {
		type: "ProjectSummary",
		project: projectName,
		date: now.toISOString(),
		reports_analyzed: snapshots.length,
		risks,
		improvements,
		positives,
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
	renderRisks(doc, findings);
	renderImprovements(doc, findings);
	renderWarnings(doc, lint, typedoc);
	renderDomainMetrics(doc, detailed);
	renderTopFilesByLoc(doc, detailed);
	renderDomainDetails(doc, snapshots, json, detailed);
	renderMetricsDictionary(doc);

	return doc;
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
	};
}

export function generateSummaryReport(projectPath: string): void {
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

	const findings = analyzeReports(snapshots, thresholds, lint, typedoc, json, detailed);
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
}

// Self-invocation when run directly via tsx
import { CLI_PROJECT } from "../../../infrastructure/config.js";

// eslint-disable-next-line no-restricted-properties
if (process.argv[1]?.includes("generate-summary-report")) {
	generateSummaryReport(CLI_PROJECT);
}
