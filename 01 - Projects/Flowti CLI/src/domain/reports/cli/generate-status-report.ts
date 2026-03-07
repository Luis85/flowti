/**
 * generate-status-report.ts — Project Status Report generator.
 *
 * Consolidates all 4 CLI reports (test, coverage, codebase, complexity)
 * into a single "Project Status Report.md" at the CLI project root.
 * Generates any missing reports before consolidating.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { CLI_PROJECT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { RESET, DIM, GREEN, CYAN } from "../../../infrastructure/ui.js";

const REPORTS_DIR = path.join(CLI_PROJECT, "docs", "reports");
const OUTPUT_PATH = path.join(CLI_PROJECT, "Project Status Report.md");

interface ReportSection {
	label: string;
	stablePath: string;
	generateCommand: string;
}

const SECTIONS: ReportSection[] = [
	{
		label: "Tests",
		stablePath: path.join(REPORTS_DIR, "tests", "Test Report.md"),
		generateCommand: "npm run report:test",
	},
	{
		label: "Coverage",
		stablePath: path.join(REPORTS_DIR, "coverage", "Coverage Report.md"),
		generateCommand: "npm run report:coverage",
	},
	{
		label: "Codebase",
		stablePath: path.join(REPORTS_DIR, "codebase", "Codebase Report.md"),
		generateCommand: "npm run report:codebase",
	},
	{
		label: "Complexity",
		stablePath: path.join(REPORTS_DIR, "complexity", "Complexity Report.md"),
		generateCommand: "npm run report:complexity",
	},
];

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
	// Strip the H1 heading (already captured by the consolidated report)
	return body.replace(/^#\s+.+\n*/, "").trim();
}

function ensureReportsExist(): void {
	const missing = SECTIONS.filter((s) => !fs.existsSync(s.stablePath));
	if (missing.length === 0) return;

	console.log(`\n  ${DIM}Generating missing reports...${RESET}`);
	for (const section of missing) {
		console.log(`  ${CYAN}▸${RESET} ${section.label}`);
		try {
			execSync(section.generateCommand, {
				cwd: CLI_PROJECT,
				stdio: "pipe",
				timeout: 120_000,
			});
		} catch {
			console.log(`  ${DIM}(skipped — ${section.label} generation failed)${RESET}`);
		}
	}
}

function buildStatusReport(): string {
	const now = new Date();

	const doc = Document.create("Project Status Report")
		.setFrontmatter("type", "ProjectStatusReport")
		.setFrontmatter("project", "flowti-cli")
		.setFrontmatter("date", now.toISOString());

	// Collect stats from each report's frontmatter
	for (const section of SECTIONS) {
		if (!fs.existsSync(section.stablePath)) continue;
		const content = fs.readFileSync(section.stablePath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		const prefix = section.label.toLowerCase();
		for (const [key, value] of Object.entries(frontmatter)) {
			if (key === "type" || key === "project" || key === "date") continue;
			doc.setFrontmatter(`${prefix}_${key}`, value);
		}
	}

	doc.addBlank()
		.heading(1, "Project Status Report")
		.addBlank()
		.text(`Generated: ${now.toISOString().replace("T", " ").substring(0, 19)}`)
		.addBlank();

	// Embed each report's body content
	for (const section of SECTIONS) {
		doc.heading(2, section.label).addBlank();

		if (!fs.existsSync(section.stablePath)) {
			doc.callout("warning", "Missing", [`${section.label} report not available.`]).addBlank();
			continue;
		}

		const content = fs.readFileSync(section.stablePath, "utf-8");
		const body = extractBody(content);
		if (body) {
			doc.text(body).addBlank();
		}

		doc.addSeparator().addBlank();
	}

	return doc.toString();
}

/** Interactive entry point — called from the project detail menu. */
export async function generateProjectStatusReport(): Promise<void> {
	console.log(`\n  ${CYAN}▸${RESET} Generating Project Status Report...\n`);
	ensureReportsExist();

	const content = buildStatusReport();
	fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
	fs.writeFileSync(OUTPUT_PATH, content, "utf-8");

	console.log(`\n  ${GREEN}✓${RESET} Project Status Report written: ${OUTPUT_PATH}\n`);
}

// Direct invocation support: tsx src/domain/reports/cli/generate-status-report.ts
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("generate-status-report");
if (isDirectRun) generateProjectStatusReport();
