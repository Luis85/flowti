/**
 * generate-status-report.ts — Project Status Report generator.
 *
 * Consolidates all 4 CLI reports (test, coverage, codebase, complexity)
 * into a single "Project Status Report.md" in the reports directory.
 * Generates any missing reports by calling generators directly.
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { Document } from "../../../infrastructure/document.js";
import { splitFrontmatter as splitFm } from "../../../infrastructure/frontmatter.js";
import { RESET, DIM, GREEN, CYAN } from "../../../infrastructure/ui.js";
import { clock } from "../../../infrastructure/clock.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";
import { generateTestReport } from "./generate-test-report.js";
import { generateCoverageReport } from "./generate-coverage-report.js";
import { generateCodebaseReport } from "./generate-codebase-report.js";
import { generateComplexityReport } from "./generate-complexity-report.js";
import type { GeneratorOutput, GeneratorFn } from "../../../infrastructure/types.js";

interface ReportSection {
	label: string;
	stablePath: string;
	generator: GeneratorFn;
}

function buildSections(svc: ReportService, projectPath: string): ReportSection[] {
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

function ensureReportsExist(sections: ReportSection[], projectPath: string): string[] {
	const missing = sections.filter((s) => !disk.existsSync(s.stablePath));
	if (missing.length === 0) return [];

	log(`\n  ${DIM}Generating missing reports...${RESET}`);
	const failures: string[] = [];
	for (const section of missing) {
		log(`  ${CYAN}▸${RESET} ${section.label}`);
		try {
			const result = section.generator(projectPath);
			if (!result.success) failures.push(section.label);
		} catch {
			failures.push(section.label);
		}
	}
	return failures;
}

const SKIP_FM_KEYS = new Set(["type", "project", "date"]);

function promoteSectionFrontmatter(doc: Document, sections: ReportSection[]): void {
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

function renderSectionBodies(doc: Document, sections: ReportSection[]): void {
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

function buildStatusReport(sections: ReportSection[], projectName: string): string {
	const now = clock.now();
	const doc = Document.create("Project Status Report")
		.setFrontmatter("type", "ProjectStatusReport")
		.setFrontmatter("project", projectName)
		.setFrontmatter("date", now.toISOString());

	promoteSectionFrontmatter(doc, sections);
	doc.addBlank().heading(1, "Project Status Report").addBlank()
		.text(`Generated: ${now.toISOString().replace("T", " ").substring(0, 19)}`).addBlank();
	renderSectionBodies(doc, sections);

	return doc.toString();
}

/** Generate the project status report. */
export function generateProjectStatusReport(projectPath: string): GeneratorOutput {
	const svc = new ReportService(projectPath);
	const sections = buildSections(svc, projectPath);
	const projectName = paths.basename(projectPath);
	const outputPath = svc.stablePath("Project Status Report.md");

	log(`\n  ${CYAN}▸${RESET} Generating Project Status Report...\n`);
	const failures = ensureReportsExist(sections, projectPath);

	const content = buildStatusReport(sections, projectName);
	disk.mkdirSync(svc.reportsDir, { recursive: true });
	disk.writeFileSync(outputPath, content, "utf-8");

	const available = sections.filter((s) => disk.existsSync(s.stablePath)).length;
	const warnings = failures.length > 0 ? [`${failures.length} sub-report(s) failed: ${failures.join(", ")}`] : undefined;

	log(`\n  ${GREEN}✓${RESET} Project Status Report written: ${outputPath}\n`);

	return { success: true, outputPath, metrics: { sections: available }, warnings };
}