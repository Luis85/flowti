/**
 * report-generators.ts — Report generators for the Review platform.
 *
 * Generates audit-ready markdown reports from traceability, evidence,
 * quality gates, and coverage data. All reports have YAML frontmatter
 * and are written to docs/reports/.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { TraceabilityMatrix, TraceabilityGap, CategoryCoverage } from "./traceability.js";
import type { GateEvaluationResult } from "./quality-gates.js";
import type { RunManifest, EvidenceSummary } from "./evidence.js";

export type ReportDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Traceability Matrix Report ───────────────────────────────────────

/** Generate a traceability matrix report as markdown. */
export function generateTraceabilityReport(
	matrix: TraceabilityMatrix,
	deps: ReportDeps,
	outputPath: string,
): string {
	const doc = Document.create("Traceability Matrix")
		.mergeFrontmatter({
			type: "Report",
			reportType: "traceability-matrix",
			date: deps.clock.iso(),
			coverage: `${matrix.coveragePercent}%`,
			totalRequirements: String(matrix.totalRequirements),
			verified: String(matrix.verified),
			untested: String(matrix.untested),
		})
		.addBlank()
		.heading(1, "Traceability Matrix")
		.addBlank()
		.text(`Generated: ${deps.clock.iso()}`)
		.addBlank()
		.heading(2, "Summary")
		.addBlank()
		.text(`- **Requirements**: ${matrix.totalRequirements}`)
		.text(`- **Verified**: ${matrix.verified} (${matrix.coveragePercent}%)`)
		.text(`- **Failed**: ${matrix.failed}`)
		.text(`- **Untested**: ${matrix.untested}`)
		.text(`- **Partial**: ${matrix.partial}`)
		.addBlank()
		.heading(2, "Matrix")
		.addBlank()
		.text("| Requirement | Status | Journey | Step | Last Result |")
		.text("|------------|--------|---------|------|-------------|");

	for (const row of matrix.rows) {
		const journey = row.journeys[0] ?? "—";
		const step = row.steps[0] ?? "—";
		const result = row.lastResult ?? "—";
		doc.text(`| ${row.requirementId} | ${row.status} | ${journey} | ${step} | ${result} |`);
	}

	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Coverage Gap Report ──────────────────────────────────────────────

/** Generate a coverage gap report. */
export function generateCoverageGapReport(
	matrix: TraceabilityMatrix,
	gaps: TraceabilityGap[],
	byCategory: CategoryCoverage[],
	deps: ReportDeps,
	outputPath: string,
): string {
	const doc = Document.create("Coverage Gap Analysis")
		.mergeFrontmatter({
			type: "Report",
			reportType: "coverage-gap",
			date: deps.clock.iso(),
			coverage: `${matrix.coveragePercent}%`,
			gaps: String(gaps.length),
		})
		.addBlank()
		.heading(1, "Coverage Gap Analysis")
		.addBlank()
		.text(`Generated: ${deps.clock.iso()}`)
		.addBlank()
		.heading(2, "Overall Coverage")
		.addBlank()
		.text(`- **Requirements**: ${matrix.totalRequirements} total`)
		.text(`- **Linked to journeys**: ${matrix.verified + matrix.partial + matrix.failed} (${matrix.coveragePercent}%)`)
		.text(`- **Untested**: ${matrix.untested}`)
		.text(`- **Failed**: ${matrix.failed}`)
		.addBlank();

	if (byCategory.length > 0) {
		doc.heading(2, "ISO 25010 Category Coverage").addBlank();
		doc.text("| Category | Total | Verified | Coverage |");
		doc.text("|----------|-------|----------|----------|");
		for (const cat of byCategory) {
			doc.text(`| ${cat.category} | ${cat.total} | ${cat.verified} | ${cat.percent}% |`);
		}
		doc.addBlank();
	}

	if (gaps.length > 0) {
		doc.heading(2, "Gaps").addBlank();
		for (const gap of gaps) {
			const label = gap.reason === "no-journey" ? "No journey linked" : gap.reason === "failed" ? "Last run failed" : "No steps verify";
			doc.text(`- **${gap.requirementId}**: ${label}`);
		}
	}

	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Quality Dashboard Report ─────────────────────────────────────────

function addCategoryScores(doc: Document, byCategory: CategoryCoverage[]): void {
	if (byCategory.length > 0) {
		doc.text("| Characteristic | Score | Status |");
		doc.text("|---------------|-------|--------|");
		for (const cat of byCategory) {
			const status = cat.percent >= 80 ? "Good" : cat.percent >= 50 ? "Fair" : "Needs Work";
			doc.text(`| ${cat.category} | ${cat.percent}% | ${status} |`);
		}
	} else {
		doc.text("No ISO 25010 category data available. Add `traceability.category` to journeys.");
	}
}

function addGateLines(doc: Document, gateResult: GateEvaluationResult | null): void {
	if (!gateResult) return;
	doc.addBlank();
	for (const gate of gateResult.gates) {
		const icon = gate.passed ? "✓" : "✗";
		doc.text(`- ${icon} **${gate.gate}**: ${gate.details}`);
	}
}

/** Generate a quality dashboard report (ISO 25010 scores). */
export function generateQualityDashboard(
	matrix: TraceabilityMatrix,
	byCategory: CategoryCoverage[],
	gateResult: GateEvaluationResult | null,
	deps: ReportDeps,
	outputPath: string,
	projectName?: string,
): string {
	const releaseStatus = gateResult
		? (gateResult.releaseEligible ? "RELEASE ELIGIBLE" : "RELEASE BLOCKED")
		: "NOT EVALUATED";

	const doc = Document.create("Quality Dashboard")
		.mergeFrontmatter({
			type: "Report", reportType: "quality-dashboard", date: deps.clock.iso(),
			project: projectName ?? "", coverage: `${matrix.coveragePercent}%`, releaseStatus,
		})
		.addBlank()
		.heading(1, `Quality Dashboard — ${projectName ?? "Project"}`)
		.addBlank().text(`Generated: ${deps.clock.iso()}`).addBlank()
		.heading(2, "ISO 25010 Quality Scores").addBlank();

	addCategoryScores(doc, byCategory);

	doc.addBlank().heading(2, "Requirement Coverage").addBlank()
		.text(`- **Overall**: ${matrix.coveragePercent}%`)
		.text(`- **Verified**: ${matrix.verified}/${matrix.totalRequirements}`)
		.text(`- **Untested**: ${matrix.untested}`)
		.addBlank().heading(2, "Release Status").addBlank()
		.text(`**${releaseStatus}**`);

	addGateLines(doc, gateResult);
	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Gate Report ──────────────────────────────────────────────────────

/** Generate a quality gate report. */
export function generateGateReport(
	gateResult: GateEvaluationResult,
	deps: ReportDeps,
	outputPath: string,
): string {
	const doc = Document.create("Quality Gate Report")
		.mergeFrontmatter({
			type: "Report",
			reportType: "gate-report",
			date: deps.clock.iso(),
			allPassed: String(gateResult.allPassed),
			releaseEligible: String(gateResult.releaseEligible),
		})
		.addBlank()
		.heading(1, "Quality Gate Report")
		.addBlank()
		.text(`Generated: ${deps.clock.iso()}`)
		.addBlank()
		.heading(2, "Gate Results")
		.addBlank()
		.text("| Gate | Status | Details |")
		.text("|------|--------|---------|");

	for (const gate of gateResult.gates) {
		const status = gate.passed ? "PASS" : "FAIL";
		doc.text(`| ${gate.gate} | ${status} | ${gate.details} |`);
	}

	doc.addBlank()
		.text(`**Release Eligible**: ${gateResult.releaseEligible ? "Yes" : "No"}`);

	if (gateResult.capaItems.length > 0) {
		doc.addBlank()
			.heading(2, "Auto-Generated CAPA Items")
			.addBlank();
		for (const capa of gateResult.capaItems) {
			doc.text(`- **${capa.severity}** — ${capa.name}`);
			doc.text(`  ${capa.description}`);
			if (capa.linkedJourney) doc.text(`  Journey: ${capa.linkedJourney}`);
		}
	}

	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Evidence Summary Report ──────────────────────────────────────────

/** Generate an evidence summary report for a run. */
export function generateEvidenceReport(
	summary: EvidenceSummary,
	deps: ReportDeps,
	outputPath: string,
): string {
	const doc = Document.create("Evidence Summary")
		.mergeFrontmatter({
			type: "Report",
			reportType: "evidence-summary",
			date: deps.clock.iso(),
			runId: summary.runId,
			artifacts: String(summary.artifacts.length),
		})
		.addBlank()
		.heading(1, `Evidence Summary — Run ${summary.runId}`)
		.addBlank()
		.text(`Generated: ${deps.clock.iso()}`)
		.addBlank()
		.heading(2, "Run Metadata")
		.addBlank()
		.text(`- **Run ID**: ${summary.manifest.runId}`)
		.text(`- **Project**: ${summary.manifest.project}`)
		.text(`- **Timestamp**: ${summary.manifest.timestamp}`)
		.text(`- **Trigger**: ${summary.manifest.trigger}`)
		.text(`- **Platform**: ${summary.manifest.environment.platform}`)
		.text(`- **Duration**: ${summary.manifest.durationMs}ms`)
		.addBlank()
		.heading(2, "Results")
		.addBlank()
		.text(`- **Journeys**: ${summary.manifest.journeyCount}`)
		.text(`- **Steps**: ${summary.manifest.totalSteps}`)
		.text(`- **Passed**: ${summary.manifest.passed}`)
		.text(`- **Failed**: ${summary.manifest.failed}`)
		.text(`- **Skipped**: ${summary.manifest.skipped}`)
		.addBlank()
		.heading(2, "Artifacts")
		.addBlank();

	if (summary.artifacts.length > 0) {
		doc.text("| Type | Journey | Step | Path |");
		doc.text("|------|---------|------|------|");
		for (const a of summary.artifacts) {
			doc.text(`| ${a.type} | ${a.journeyName} | ${a.stepId} | ${a.path} |`);
		}
	} else {
		doc.text("No artifacts collected.");
	}

	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Audit Report ─────────────────────────────────────────────────────

function addAuditGatesSection(doc: Document, gateResult: GateEvaluationResult | null): void {
	doc.heading(2, "2. Quality Gates (ISO 9001 §8.6)").addBlank();
	if (gateResult) {
		addGateLines(doc, gateResult);
		doc.addBlank().text(`**Release Eligible**: ${gateResult.releaseEligible ? "Yes" : "No"}`);
	} else {
		doc.text("Quality gates not configured.");
	}
}

function addAuditCAPASection(doc: Document, gateResult: GateEvaluationResult | null): void {
	doc.heading(2, "3. Corrective Actions (ISO 9001 §8.5.2)").addBlank();
	if (gateResult?.capaItems.length) {
		for (const capa of gateResult.capaItems) doc.text(`- **${capa.severity}**: ${capa.name}`);
	} else {
		doc.text("No corrective actions required.");
	}
}

function addAuditEvidenceSection(doc: Document, runs: RunManifest[]): void {
	doc.heading(2, "4. Evidence (ISO 9001 §9.1.1)").addBlank();
	if (runs.length > 0) {
		doc.text("| Run ID | Date | Passed | Failed | Skipped |");
		doc.text("|--------|------|--------|--------|---------|");
		for (const run of runs.slice(0, 10)) {
			doc.text(`| ${run.runId} | ${run.timestamp} | ${run.passed} | ${run.failed} | ${run.skipped} |`);
		}
	} else {
		doc.text("No evidence runs recorded.");
	}
}

/** Generate a composite audit report. */
export function generateAuditReport(
	matrix: TraceabilityMatrix,
	gateResult: GateEvaluationResult | null,
	runs: RunManifest[],
	deps: ReportDeps,
	outputPath: string,
	projectName?: string,
): string {
	const doc = Document.create("Audit Report")
		.mergeFrontmatter({
			type: "Report", reportType: "audit-report", date: deps.clock.iso(),
			project: projectName ?? "", standards: "ISO 9001, ISO 27001, ISO 25010, IREB",
		})
		.addBlank()
		.heading(1, `Audit Report — ${projectName ?? "Project"}`)
		.addBlank().text(`Generated: ${deps.clock.iso()}`)
		.text("Standards: ISO 9001, ISO 27001, ISO 25010, IREB").addBlank()
		.heading(2, "1. Requirements Traceability (IREB §4.2)").addBlank()
		.text(`- **Total Requirements**: ${matrix.totalRequirements}`)
		.text(`- **Verified**: ${matrix.verified} (${matrix.coveragePercent}%)`)
		.text(`- **Untested**: ${matrix.untested}`)
		.text(`- **Failed**: ${matrix.failed}`).addBlank();

	addAuditGatesSection(doc, gateResult);
	doc.addBlank();
	addAuditCAPASection(doc, gateResult);
	doc.addBlank();
	addAuditEvidenceSection(doc, runs);
	doc.save(outputPath, deps.disk);
	return outputPath;
}

// ── Run History Report ───────────────────────────────────────────────

/** Generate a run history report showing trends. */
export function generateRunHistoryReport(
	runs: RunManifest[],
	deps: ReportDeps,
	outputPath: string,
): string {
	const doc = Document.create("Run History")
		.mergeFrontmatter({
			type: "Report",
			reportType: "run-history",
			date: deps.clock.iso(),
			totalRuns: String(runs.length),
		})
		.addBlank()
		.heading(1, "E2E Run History")
		.addBlank()
		.text(`Generated: ${deps.clock.iso()}`)
		.text(`Total runs: ${runs.length}`)
		.addBlank();

	if (runs.length > 0) {
		doc.text("| Run ID | Date | Journeys | Passed | Failed | Duration |");
		doc.text("|--------|------|----------|--------|--------|----------|");
		for (const run of runs) {
			const duration = `${Math.round(run.durationMs / 1000)}s`;
			doc.text(`| ${run.runId} | ${run.timestamp} | ${run.journeyCount} | ${run.passed} | ${run.failed} | ${duration} |`);
		}
	}

	doc.save(outputPath, deps.disk);
	return outputPath;
}
