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
} from "./summary-types.js";
import { n, d } from "./summary-formatters.js";
import {
	resolveThresholds,
	discoverReports,
	loadJsonDataSources,
	loadDetailedSources,
	collectLintWarnings,
} from "./summary-loaders.js";
import { analyzeReports } from "./summary-analyzers.js";
import {
	promoteFrontmatter,
	renderOverview,
	renderRisks,
	renderImprovements,
	renderWarnings,
	renderDomainMetrics,
	renderDomainDetails,
	renderMetricsDictionary,
} from "./summary-renderers.js";

// ── Document builder ─────────────────────────────────────────────────

function buildSummaryReport(
	snapshots: ReportSnapshot[],
	findings: Finding[],
	lint: LintResult | null,
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
		...promoteFrontmatter(snapshots, json, lint, detailed),
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

	renderOverview(doc, json, detailed, lint, thresholds, findings);
	renderRisks(doc, findings);
	renderImprovements(doc, findings);
	renderWarnings(doc, lint);
	renderDomainMetrics(doc, detailed);
	renderDomainDetails(doc, snapshots, json, detailed);
	renderMetricsDictionary(doc);

	return doc;
}

// ── Entry point ──────────────────────────────────────────────────────

export function generateSummaryReport(projectPath: string): void {
	const svc = new ReportService(projectPath);
	const projectName = paths.basename(projectPath);
	const thresholds = resolveThresholds(projectPath);

	log(`\n  ${CYAN}▸${RESET} Generating Project Summary...\n`);

	const snapshots = discoverReports(svc.reportsDir);
	const json = loadJsonDataSources(svc.reportsDir);
	const detailed = loadDetailedSources(svc.reportsDir, projectPath);
	const jsonLabels: string[] = [];
	if (json.tests) jsonLabels.push("tests");
	if (json.coverage) jsonLabels.push("coverage");
	log(`  ${DIM}Found ${snapshots.length} reports: ${snapshots.map((s) => s.label).join(", ")}${RESET}`);
	if (jsonLabels.length > 0) {
		log(`  ${DIM}JSON sources: ${jsonLabels.join(", ")}${RESET}`);
	}
	if (detailed.perFile.length > 0) {
		log(`  ${DIM}Per-file coverage: ${detailed.perFile.length} files${RESET}`);
	}

	let lint: LintResult | null = null;
	if (thresholds.lintCommand) {
		log(`  ${DIM}Running lint: ${thresholds.lintCommand}${RESET}`);
		lint = collectLintWarnings(projectPath, thresholds.lintCommand);
		log(`  ${DIM}Lint: ${lint.errors} errors, ${lint.warnings} warnings${RESET}`);
	}

	const findings = analyzeReports(snapshots, thresholds, lint, json, detailed);
	const doc = buildSummaryReport(snapshots, findings, lint, thresholds, projectName, json, detailed);

	const stablePath = svc.stablePath("Project Summary.md");
	disk.mkdirSync(svc.reportsDir, { recursive: true });
	doc.save(stablePath);

	const summaryDir = svc.subdir("summary");
	disk.mkdirSync(summaryDir, { recursive: true });
	const safeTimestamp = clock.safeIso();
	const timestampedPath = paths.join(summaryDir, `${safeTimestamp}-project-summary.md`);
	doc.save(timestampedPath);

	const risks = findings.filter((f) => f.category === "risk").length;
	const improvements = findings.filter((f) => f.category === "improvement").length;
	const positives = findings.filter((f) => f.category === "positive").length;

	const jsonData = {
		type: "ProjectSummary",
		project: projectName,
		date: clock.iso(),
		reportsAnalyzed: snapshots.length,
		summary: { risks, improvements, positives },
		metrics: promoteFrontmatter(snapshots, json, lint, detailed),
		findings: {
			risks: findings.filter((f) => f.category === "risk").map((f) => ({ message: f.message, details: f.details })),
			improvements: findings.filter((f) => f.category === "improvement").map((f) => ({ message: f.message, details: f.details })),
			positives: findings.filter((f) => f.category === "positive").map((f) => ({ message: f.message, details: f.details })),
		},
		lint: lint ? { errors: lint.errors, warnings: lint.warnings, breakdown: lint.breakdown, issues: lint.issues } : null,
		thresholds,
		reports: snapshots.map((s) => ({ label: s.label, file: s.file, frontmatter: s.frontmatter })),
		jsonSources: { tests: json.tests ?? null, coverage: json.coverage ?? null },
	};

	const jsonPath = paths.join(summaryDir, `${safeTimestamp}-project-summary.json`);
	disk.writeFileSync(jsonPath, JSON.stringify(jsonData, null, "\t"), "utf-8");

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
