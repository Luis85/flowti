/**
 * generate-status-report.ts — Project Status Report generator.
 *
 * Consolidates all 4 CLI reports (test, coverage, codebase, complexity)
 * into a single "Project Status Report.md" in the reports directory.
 * Generates any missing reports before consolidating.
 */

import { paths } from "../../../infrastructure/paths.js";
import { proc } from "../../../infrastructure/proc.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { shell } from "../../../infrastructure/shell.js";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { RESET, DIM, GREEN, CYAN } from "../../../infrastructure/ui.js";
import { clock } from "../../../infrastructure/clock.js";
import { ReportService } from "./report-service.js";
import { log } from "../../../infrastructure/logger.js";

interface ReportSection {
	label: string;
	stablePath: string;
	generateCommand: string;
}

function buildSections(svc: ReportService): ReportSection[] {
	return [
		{
			label: "Tests",
			stablePath: svc.stablePath("Test Report.md"),
			generateCommand: "npm run report:test",
		},
		{
			label: "Coverage",
			stablePath: svc.stablePath("Coverage Report.md"),
			generateCommand: "npm run report:coverage",
		},
		{
			label: "Codebase",
			stablePath: svc.stablePath("Codebase Report.md"),
			generateCommand: "npm run report:codebase",
		},
		{
			label: "Complexity",
			stablePath: svc.stablePath("Complexity Report.md"),
			generateCommand: "npm run report:complexity",
		},
	];
}

interface ParsedFrontmatter {
	[key: string]: string;
}

function parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
	const lines = content.split("\n");
	const fm: ParsedFrontmatter = {};
	let bodyStart = 0;

	if (lines[0]?.trim() === "---") {
		const endIdx = lines.indexOf("---", 1);
		if (endIdx > 0) {
			for (let i = 1; i < endIdx; i++) {
				const match = lines[i].match(/^(\w[\w_]*)\s*:\s*(.*)$/);
				if (match) fm[match[1]] = match[2].replace(/^["']|["']$/g, "");
			}
			bodyStart = endIdx + 1;
		}
	}

	return { frontmatter: fm, body: lines.slice(bodyStart).join("\n").trim() };
}

function extractBody(content: string): string {
	const { body } = parseFrontmatter(content);
	return body.replace(/^#\s+.+\n*/, "").trim();
}

function ensureReportsExist(sections: ReportSection[], projectPath: string): void {
	const missing = sections.filter((s) => !disk.existsSync(s.stablePath));
	if (missing.length === 0) return;

	log(`\n  ${DIM}Generating missing reports...${RESET}`);
	for (const section of missing) {
		log(`  ${CYAN}▸${RESET} ${section.label}`);
		const result = shell.runSilent(section.generateCommand, { cwd: projectPath });
		if (result === null) {
			log(`  ${DIM}(skipped — ${section.label} generation failed)${RESET}`);
		}
	}
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

/** Interactive entry point — called from the Reports submenu. */
export async function generateProjectStatusReport(projectPath?: string): Promise<void> {
	const resolvedPath = projectPath ?? CLI_PROJECT;
	const svc = new ReportService(resolvedPath);
	const sections = buildSections(svc);
	const projectName = paths.basename(resolvedPath);
	const outputPath = svc.stablePath("Project Status Report.md");

	log(`\n  ${CYAN}▸${RESET} Generating Project Status Report...\n`);
	ensureReportsExist(sections, resolvedPath);

	const content = buildStatusReport(sections, projectName);
	disk.mkdirSync(svc.reportsDir, { recursive: true });
	disk.writeFileSync(outputPath, content, "utf-8");

	log(`\n  ${GREEN}✓${RESET} Project Status Report written: ${outputPath}\n`);
}

// Direct invocation support: tsx src/domain/reports/cli/generate-status-report.ts
const isDirectRun = proc.argv().some((a) => a.replace(/\\/g, "/").includes("generate-status-report"));
if (isDirectRun) generateProjectStatusReport();
