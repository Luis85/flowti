/**
 * reports.ts — Report generation menu and commands.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { ROOT, config } from "../../infrastructure/config.js";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW, printHeader } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { findLatestReport, parseFrontmatter } from "../../infrastructure/fs.js";
import { runMenu } from "../../infrastructure/menu.js";
import { showHelp } from "../help/help.js";
import { Document } from "../../infrastructure/document.js";
import { clock } from "../../infrastructure/clock.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";

interface RptCfg {
	allCommand?: string;
	dir?: string;
	outputDir?: string;
	auditSubdir?: string;
	categories?: Array<{ dir: string; label: string }>;
	stableReports?: Array<{ file: string; label: string }>;
	scripts?: Array<{ id: string; label: string; script: string }>;
}

const rptCfg: RptCfg = ((config as Record<string, unknown>).reports as RptCfg) ?? {};

// ── Helpers ─────────────────────────────────────────────────────────

interface ReportScript { id: string; label: string; script: string }

function getReportScripts(): ReportScript[] {
	return rptCfg.scripts ?? [];
}

// ── Interactive menu ────────────────────────────────────────────────

export async function menu(): Promise<MenuResult> {
	return runMenu("Reports", [
		{ key: "1", label: "Build all reports", action: () => {
			shell.run(rptCfg.allCommand ?? "npm run generate:reports", { label: "Generating all reports..." });
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
		log(`\n  ${YELLOW}No report scripts configured in flowti.config.json.${RESET}\n`);
		return;
	}

	printHeader("Select Report");
	for (let i = 0; i < scripts.length; i++) {
		const num = String(i + 1).padStart(2, " ");
		log(`    ${num}) ${scripts[i].label}`);
	}
	log();
	log(`     ${DIM}a) All reports${RESET}`);
	log(`     ${DIM}b) Back${RESET}`);
	log();

	const rl = createRL();
	const choice = await ask(rl, "Choice", "b");
	rl.close();

	if (choice.toLowerCase() === "b") return;
	if (choice.toLowerCase() === "a") {
		shell.run(rptCfg.allCommand ?? "npm run generate:reports", { label: "Generating all reports..." });
		return;
	}

	const idx = parseInt(choice, 10) - 1;
	if (idx >= 0 && idx < scripts.length) {
		const script = scripts[idx];
		const scriptPath = paths.join(ROOT, "scripts", script.script);
		if (!disk.existsSync(scriptPath)) {
			log(`\n  ${RED}Script not found: ${script.script}${RESET}\n`);
			return;
		}
		shell.run(`node scripts/${script.script}`, { label: `Generating ${script.label}...` });
	} else {
		log("\n  Invalid choice.\n");
	}
}

// ── Audit sub-menu ──────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
	{ dir: "builds", label: "Build" },
	{ dir: "tests", label: "Unit Tests" },
	{ dir: "coverage", label: "Coverage" },
	{ dir: "performance", label: "Performance" },
	{ dir: "cycles", label: "Cycle" },
	{ dir: "complexity", label: "Complexity" },
];

const DEFAULT_STABLE_REPORTS = [
	{ file: "traceability/Trace Conformance Report.md", label: "Traceability" },
	{ file: "e2e/E2E Report.md", label: "E2E Tests" },
];

function collectAuditSections(reportsDir: string): Array<{ label: string; data: Record<string, string>; file: string }> {
	const sections: Array<{ label: string; data: Record<string, string>; file: string }> = [];

	for (const cat of rptCfg.categories ?? DEFAULT_CATEGORIES) {
		const latest = findLatestReport(paths.join(reportsDir, cat.dir));
		if (latest) sections.push({ label: cat.label, data: parseFrontmatter(latest), file: paths.basename(latest) });
	}

	for (const sr of rptCfg.stableReports ?? DEFAULT_STABLE_REPORTS) {
		const filePath = paths.join(reportsDir, sr.file);
		if (disk.existsSync(filePath)) sections.push({ label: sr.label, data: parseFrontmatter(filePath), file: sr.file });
	}

	return sections;
}

async function auditMenu(): Promise<void> {
	const rl = createRL();
	const defaultName = clock.iso().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);
	rl.close();

	log(`\n  ${CYAN}▸${RESET} Generating audit: ${auditName}\n`);

	const reportsDir = paths.join(ROOT, rptCfg.dir ?? rptCfg.outputDir ?? "docs/reports");
	const auditDir = paths.join(reportsDir, rptCfg.auditSubdir ?? "audits");
	try { disk.mkdirSync(auditDir, { recursive: true }); } catch { /* ignore */ }

	const sections = collectAuditSections(reportsDir);
	const now = clock.now();
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

	const auditPath = paths.join(auditDir, `${auditName}.md`);
	doc.save(auditPath);
	log(`  ${GREEN}✓${RESET} Audit written to: ${paths.relative(ROOT, auditPath)}\n`);
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	reports: () => {
		shell.run(rptCfg.allCommand ?? "npm run generate:reports", { label: "Generating all reports..." });
	},
	"reports:audit": () => {
		shell.run(rptCfg.allCommand ?? "npm run generate:reports", { label: "Generating reports for audit..." });
		log(`  ${GREEN}✓${RESET} Reports generated. Use interactive mode for full audit.\n`);
	},
	"report:*": (_flags: Record<string, string | boolean>, _rawArgs: string[], command?: string) => {
		const reportId = command!.substring("report:".length);
		const scripts = getReportScripts();
		const script = scripts.find((s) => s.id === reportId);
		if (script) {
			shell.run(`node scripts/${script.script}`, { label: `Generating ${script.label}...` });
		} else {
			log(`\n  ${RED}Unknown report: ${reportId}${RESET}`);
			log(`  ${DIM}Available: ${scripts.map((s) => s.id).join(", ")}${RESET}\n`);
		}
	},
};
