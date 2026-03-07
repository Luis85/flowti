/**
 * reports.mjs — Report generation menu and commands.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, config } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { run } from "../../infrastructure/shell.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { findLatestReport, parseFrontmatter } from "../../infrastructure/fs.mjs";
import { showHelp } from "../help/help.mjs";

// ── Helpers ─────────────────────────────────────────────────────────

function getReportScripts() {
	return config.reports?.scripts ?? [];
}

// ── Interactive menu ────────────────────────────────────────────────

export async function menu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Reports");
		printMenu([
			{ key: "1", label: "Build all reports" },
			{ key: "2", label: "Build selected report" },
			{ key: "3", label: "Build audit report" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run("npm run generate:reports", "Generating all reports...");
				break;
			case "2":
				await selectReportMenu();
				break;
			case "3":
				await auditMenu();
				break;
			case "?":
				showHelp("reports");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

// ── Select report sub-menu ──────────────────────────────────────────

async function selectReportMenu() {
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
		run("npm run generate:reports", "Generating all reports...");
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

async function auditMenu() {
	const rl = createRL();
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);
	rl.close();

	console.log(`\n  ${CYAN}▸${RESET} Generating audit: ${auditName}\n`);

	const reportsDir = path.join(ROOT, "docs", "reports");
	const auditDir = path.join(reportsDir, "audits");

	try { fs.mkdirSync(auditDir, { recursive: true }); } catch { /* ignore */ }

	const sections = [];
	const reportCategories = [
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

	const stableReports = [
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
	const lines = [
		"---",
		"type: Audit",
		`name: "${auditName}"`,
		`date: "${now.toISOString()}"`,
		"tags:",
		"  - audit",
		"  - review",
		"---",
		"",
		`# Audit: ${auditName}`,
		"",
		`> Generated: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		"",
	];

	for (const section of sections) {
		lines.push(`## ${section.label}`);
		lines.push("");
		lines.push(`> Source: ${section.file}`);
		lines.push("");
		if (section.data && Object.keys(section.data).length > 0) {
			lines.push("| Metric | Value |");
			lines.push("|---|---|");
			for (const [key, value] of Object.entries(section.data)) {
				if (key === "tags" || key === "type") continue;
				lines.push(`| ${key} | ${value} |`);
			}
		} else {
			lines.push("*No data available.*");
		}
		lines.push("");
	}

	const auditPath = path.join(auditDir, `${auditName}.md`);
	fs.writeFileSync(auditPath, lines.join("\n"), "utf-8");
	console.log(`  ${GREEN}✓${RESET} Audit written to: ${path.relative(ROOT, auditPath)}\n`);
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	reports: () => {
		run("npm run generate:reports", "Generating all reports...");
	},
	"reports:audit": () => {
		run("npm run generate:reports", "Generating reports for audit...");
		console.log(`  ${GREEN}✓${RESET} Reports generated. Use interactive mode for full audit.\n`);
	},
	"report:*": (flags, _rawArgs, command) => {
		const reportId = command.substring("report:".length);
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
