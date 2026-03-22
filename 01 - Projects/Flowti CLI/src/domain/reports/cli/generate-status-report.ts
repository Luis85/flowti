/**
 * generate-status-report.ts — Project Status Report generator.
 *
 * Consolidates all 4 CLI reports (test, coverage, codebase, complexity)
 * into a single "Project Status Report.md" in the reports directory.
 * Generates any missing reports by calling generators directly.
 */

import { Document } from "../../../infrastructure/document.js";
import { splitFrontmatter as splitFm } from "../../../infrastructure/frontmatter.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { generateTestReport } from "./generate-test-report.js";
import { generateCoverageReport } from "./generate-coverage-report.js";
import { generateCodebaseReport } from "./generate-codebase-report.js";
import { generateComplexityReport } from "./generate-complexity-report.js";
import type { GeneratorOutput, GeneratorFn } from "../../../infrastructure/types.js";
import { checkFreshness, resolveBuildPaths } from "../../build/build-freshness.js";

interface ReportSection {
	label: string;
	stablePath: string;
	generator: GeneratorFn;
}

function buildSections(svc: ReportService, _projectPath: string): ReportSection[] {
	return [
		{
			label: "Test",
			stablePath: svc.stablePath("Test Report.md"),
			generator: generateTestReport,
		},
		{
			label: "Coverage",
			stablePath: svc.stablePath("Coverage Report.md"),
			generator: generateCoverageReport,
		},
		{
			label: "Codebase",
			stablePath: svc.stablePath("Codebase Report.md"),
			generator: generateCodebaseReport,
		},
		{
			label: "Complexity",
			stablePath: svc.stablePath("Complexity Report.md"),
			generator: generateComplexityReport,
		},
	];
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
	const result = splitFm(content);
	if (!result) return { frontmatter: {}, body: content.trim() };
	return { frontmatter: result.frontmatter, body: result.body.trim() };
}

function extractBody(content: string): string {
	const { body } = parseFrontmatter(content);
	return body.replace(/^#\s+.+\n*/, "").trim();
}

function ensureReportsExist(sections: ReportSection[], projectPath: string, deps: ReportDeps, log: (msg: string) => void): string[] {
	const missing = sections.filter((s) => !deps.disk.existsSync(s.stablePath));
	if (missing.length === 0) return [];

	log("Generating missing reports...");
	const failures: string[] = [];
	for (const section of missing) {
		log(`  ▸ ${section.label}`);
		try {
			const result = section.generator(projectPath, deps);
			if (!result.success) failures.push(section.label);
		} catch {
			failures.push(section.label);
		}
	}
	return failures;
}

const SKIP_FM_KEYS = new Set(["type", "project", "date"]);

function promoteSectionFrontmatter(doc: Document, sections: ReportSection[], disk: ReportDeps["disk"]): void {
	for (const section of sections) {
		if (!disk.existsSync(section.stablePath)) continue;
		const content = disk.readFileSync(section.stablePath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		const prefix = section.label.toLowerCase();
		for (const [key, value] of Object.entries(frontmatter)) {
			if (!SKIP_FM_KEYS.has(key)) doc.setFrontmatter(`${prefix}_${key}`, value);
		}
	}
}

function renderSectionBodies(doc: Document, sections: ReportSection[], disk: ReportDeps["disk"]): void {
	for (const section of sections) {
		doc.heading(2, section.label).addBlank();
		if (!disk.existsSync(section.stablePath)) {
			doc.callout("warning", "Missing", [`${section.label} report not available.`]).addBlank();
			continue;
		}
		const body = extractBody(disk.readFileSync(section.stablePath, "utf-8"));
		if (body) doc.text(body).addBlank();
		doc.addSeparator().addBlank();
	}
}

function renderBuildFreshness(doc: Document, projectPath: string, deps: ReportDeps): void {
	const { srcDir, binDir } = resolveBuildPaths(projectPath, deps);

	doc.heading(2, "Build Freshness").addBlank();
	try {
		const freshness = checkFreshness(srcDir, binDir, deps);
		doc.setFrontmatter("build_fresh", String(!freshness.needsRebuild));
		if (!freshness.needsRebuild) {
			doc.callout("tip", "Up to date", ["Build output matches source."]).addBlank();
		} else {
			const lines = [freshness.reason];
			if (freshness.added.length > 0) lines.push(`Added: ${freshness.added.length} file(s)`);
			if (freshness.modified.length > 0) lines.push(`Modified: ${freshness.modified.length} file(s)`);
			if (freshness.removed.length > 0) lines.push(`Removed: ${freshness.removed.length} file(s)`);
			doc.callout("warning", "Rebuild needed", lines).addBlank();
		}
	} catch {
		doc.callout("warning", "Unavailable", ["Could not determine build freshness."]).addBlank();
	}
	doc.addSeparator().addBlank();
}

function buildStatusReport(sections: ReportSection[], projectName: string, projectPath: string, deps: ReportDeps, svc: ReportService): string {
	const now = deps.clock.now();
	const doc = Document.create("Project Status Report")
		.setFrontmatter("type", "ProjectStatusReport")
		.setFrontmatter("project", projectName)
		.setFrontmatter("date", now.toISOString());

	svc.stampProjectLink(doc);
	promoteSectionFrontmatter(doc, sections, deps.disk);
	doc.addBlank().heading(1, "Project Status Report").addBlank()
		.text(`Generated: ${now.toISOString().replace("T", " ").substring(0, 19)}`).addBlank();
	renderSectionBodies(doc, sections, deps.disk);
	renderBuildFreshness(doc, projectPath, deps);

	return doc.toString();
}

/** Generate the project status report. */
export function generateProjectStatusReport(projectPath: string, deps: ReportDeps, ctx?: import("../../../infrastructure/pipeline/pipeline-types.js").PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const sections = buildSections(svc, projectPath);
	const projectName = deps.paths.basename(projectPath);
	const outputPath = svc.stablePath("Project Status Report.md");

	log("Generating Project Status Report...");
	const failures = ensureReportsExist(sections, projectPath, deps, log);

	const content = buildStatusReport(sections, projectName, projectPath, deps, svc);
	deps.disk.mkdirSync(svc.reportsDir, { recursive: true });
	deps.disk.writeFileSync(outputPath, content, "utf-8");

	const available = sections.filter((s) => deps.disk.existsSync(s.stablePath)).length;
	const warnings = failures.length > 0 ? [`${failures.length} sub-report(s) failed: ${failures.join(", ")}`] : undefined;

	log(`Project Status Report written: ${outputPath}`);

	return { success: true, outputPath, metrics: { sections: available }, warnings };
}