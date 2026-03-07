/**
 * reports.ts — Report generation menu and commands.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, config } from "../../infrastructure/config.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { run } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { findLatestReport, parseFrontmatter } from "../../infrastructure/fs.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { Document } from "../../infrastructure/document.js";
import type { MenuResult } from "../../types.js";

const rptCfg = (config as Record<string, unknown>).reports as Record<string, unknown> ?? {};

// ── Helpers ─────────────────────────────────────────────────────────

interface ReportScript { id: string; label: string; script: string }

function getReportScripts(): ReportScript[] {
	return ((config as Record<string, unknown>).reports as Record<string, unknown>)?.scripts as ReportScript[] ?? [];
}

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(): Promise<MenuResult> {
	return runMenu("Reports", [
		{ key: "1", label: "Build all reports", action: () => {
			run(rptCfg.allCommand ?? "npm run generate:reports", "Generating all reports...");
		}},
		{ key: "2", label: "Build selected report", action: selectReportMenu },
		{ key: "3", label: "Build audit report", action: auditMenu },
		{ separator: true },
		{ key: "?", label: "Help", action: () => { showHelp("reports"); } },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	]);
}

// ── Select report sub-menu ──────────────────────────────────────────

async function selectReportMenu(): Promise<void> {
	const scripts = getReportScripts();
	if (!scripts.length) {
		console.log(`\n  ${YELLOW}No report scripts configured in flowti.config.json.${RESET}\n`);
		return;
	}

	printHeader("Select Report");
	for (let i = 0; i < scripts.length; i++) {
		const num = String(i + 1).padStart(2, " ");
		console.log(`    ${num}) ${scripts[i].label}`);
	}
	console.log();
	console.log(`     ${DIM}a) All reports${RESET}`);
	console.log(`     ${DIM}b) Back${RESET}`);
	console.log();

	const rl = createRL();
	const choice = await ask(rl, "Choice", "b");
	rl.close();

	if (choice.toLowerCase() === "b") return;
	if (choice.toLowerCase() === "a") {
		run(rptCfg.allCommand ?? "npm run generate:reports", "Generating all reports...");
		return;
	}

	const idx = parseInt(choice, 10) - 1;
	if (idx >= 0 && idx < scripts.length) {
		const script = scripts[idx];
		const scriptPath = path.join(ROOT, "scripts", script.script);
		if (!fs.existsSync(scriptPath)) {
			console.log(`\n  ${RED}Script not found: ${script.script}${RESET}\n`);
			return;
		}
		run(`node scripts/${script.script}`, `Generating ${script.label}...`);
	} else {
		console.log("\n  Invalid choice.\n");
	}
}

// ── Audit sub-menu ──────────────────────────────────────────────────

async function auditMenu(): Promise<void> {
	const rl = createRL();
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);
	rl.close();

	console.log(`\n  ${CYAN}▸${RESET} Generating audit: ${auditName}\n`);

	const reportsDir = path.join(ROOT, (rptCfg.dir ?? rptCfg.outputDir ?? "docs/reports") as string);
	const auditDir = path.join(reportsDir, rptCfg.auditSubdir ?? "audits");

	try { fs.mkdirSync(auditDir, { recursive: true }); } catch { /* ignore */ }

	const sections: Array<{ label: string; data: Record<string, string>; file: string }> = [];
	const reportCategories = rptCfg.categories ?? [
		{ dir: "builds", label: "Build" },
		{ dir: "tests", label: "Unit Tests" },
		{ dir: "coverage", label: "Coverage" },
		{ dir: "performance", label: "Performance" },
		{ dir: "cycles", label: "Cycle" },
		{ dir: "complexity", label: "Complexity" },
	];

	for (const cat of reportCategories) {
		const catDir = path.join(reportsDir, cat.dir);
		const latest = findLatestReport(catDir);
		if (latest) {
			const fm = parseFrontmatter(latest);
			sections.push({ label: cat.label, data: fm, file: path.basename(latest) });
		}
	}

	const stableReports = rptCfg.stableReports ?? [
		{ file: "traceability/Trace Conformance Report.md", label: "Traceability" },
		{ file: "e2e/E2E Report.md", label: "E2E Tests" },
	];

	for (const sr of stableReports) {
		const filePath = path.join(reportsDir, sr.file);
		if (fs.existsSync(filePath)) {
			const fm = parseFrontmatter(filePath);
			sections.push({ label: sr.label, data: fm, file: sr.file });
		}
	}

	const now = new Date();
	const doc = Document.create(auditName)
		.mergeFrontmatter({ type: "Audit", name: auditName, date: now.toISOString() })
		.setTags(["audit", "review"])
		.addBlank()
		.heading(1, `Audit: ${auditName}`)
		.addBlank()
		.quote(`Generated: ${now.toISOString().slice(0, 16).replace("T", " ")}`)
		.addBlank();

	for (const section of sections) {
		doc.heading(2, section.label).addBlank();
		doc.quote(`Source: ${section.file}`).addBlank();
		if (section.data && Object.keys(section.data).length > 0) {
			const rows = Object.entries(section.data)
				.filter(([key]) => key !== "tags" && key !== "type")
				.map(([key, value]) => [key, String(value)]);
			doc.table(["Metric", "Value"], rows);
		} else {
			doc.text("*No data available.*");
		}
		doc.addBlank();
	}

	const auditPath = path.join(auditDir, `${auditName}.md`);
	doc.save(auditPath);
	console.log(`  ${GREEN}✓${RESET} Audit written to: ${path.relative(ROOT, auditPath)}\n`);
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	reports: () => {
		run(rptCfg.allCommand ?? "npm run generate:reports", "Generating all reports...");
	},
	"reports:audit": () => {
		run(rptCfg.allCommand ?? "npm run generate:reports", "Generating reports for audit...");
		console.log(`  ${GREEN}✓${RESET} Reports generated. Use interactive mode for full audit.\n`);
	},
	"report:*": (_flags: Record<string, string | boolean>, _rawArgs: string[], command?: string) => {
		const reportId = command!.substring("report:".length);
		const scripts = getReportScripts();
		const script = scripts.find((s) => s.id === reportId);
		if (script) {
			run(`node scripts/${script.script}`, `Generating ${script.label}...`);
		} else {
			console.log(`\n  ${RED}Unknown report: ${reportId}${RESET}`);
			console.log(`  ${DIM}Available: ${scripts.map((s) => s.id).join(", ")}${RESET}\n`);
		}
	},
};
