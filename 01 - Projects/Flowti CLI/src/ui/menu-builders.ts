/**
 * menu-builders.ts — Submenu builders for the project detail menu.
 *
 * Extracted from mainMenu.ts for readability and independent testability.
 * Each builder returns a MenuEntry[] for use with runMenu().
 */

import { runAllReports } from "../domain/reports/report-runner.js";
import { runGenerator } from "../domain/reports/generator-registry.js";
import { runReference } from "../domain/reports/generator-registry.js";
import { browseArchive } from "./menus/report-archive-menu.js";
import { exportReportToHtml } from "../domain/reports/html-export.js";
import { ReportService } from "../domain/reports/cli/report-service.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { shell } from "../infrastructure/shell.js";
import { input } from "../infrastructure/input.js";
import { log } from "../infrastructure/logger.js";
import { createDefaultDeps } from "../infrastructure/deps.js";
import { RESET, DIM, GREEN, RED } from "../infrastructure/ui.js";
import type { MenuEntry } from "../infrastructure/types.js";
import { buildDependencyGraph } from "../domain/project/project-deps.js";
import { displayDependencyGraph } from "./deps-display.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ReportGenerator {
	id?: string;
	label: string;
	command?: string;
}

export interface DocsGenerator {
	label: string;
	command: string;
}

function exportAllReportsToHtml(projectPath: string): void {
	const svc = new ReportService(projectPath, createDefaultDeps());
	const outputDir = paths.join(svc.reportsDir, "html");
	const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
	if (entries.length === 0) { log(`\n  ${DIM}No report files found. Run reports first.${RESET}\n`); return; }
	let exported = 0;
	for (const entry of entries) {
		const result = exportReportToHtml(paths.join(svc.reportsDir, entry), outputDir);
		if (result) { log(`  ${GREEN}✓${RESET} ${result.title} → ${DIM}${result.outputPath}${RESET}`); exported++; }
	}
	log(`\n  ${exported} report${exported !== 1 ? "s" : ""} exported to ${DIM}${outputDir}${RESET}\n`);
}

// ── Reports submenu ────────────────────────────────────────────────

export function buildReportsSubmenu(
	generators: ReportGenerator[],
	projectPath: string,
	reportsDir: string,
): MenuEntry[] {
	const items: MenuEntry[] = [];

	if (generators.length > 0) {
		items.push({
			key: "1",
			label: "Run All Reports",
			action: async () => {
				await runAllReports(generators, projectPath);
				await input.waitForEnter();
				return "main" as const;
			},
		});
	}

	const offset = generators.length > 0 ? 2 : 1;
	for (let i = 0; i < generators.length; i++) {
		const gen = generators[i];
		items.push({
			key: String(i + offset),
			label: gen.label,
			action: async () => {
				if (gen.id) {
					runGenerator(gen.id, projectPath, createDefaultDeps());
				} else if (gen.command) {
					shell.run(gen.command, { cwd: projectPath, label: gen.label });
				}
				await input.waitForEnter();
				return "main" as const;
			},
		});
	}

	items.push(
		{ separator: true },
		{
			key: "h",
			label: "Export to HTML",
			action: () => { exportAllReportsToHtml(projectPath); return "main" as const; },
		},
		{
			key: "a",
			label: "Browse Archive",
			action: () => browseArchive(reportsDir),
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}

// ── Documentation submenu ──────────────────────────────────────────

const BUILTIN_DOCS = [
	{ label: "CLI Reference", generatorId: "cli-reference" },
	{ label: "Entity Reference", generatorId: "entity-reference" },
];

export function buildDocsSubmenu(
	configGenerators: DocsGenerator[],
	allCommand: string | undefined,
	projectPath: string,
): MenuEntry[] {
	const items: MenuEntry[] = [];
	let keyIdx = 1;

	items.push({
		key: String(keyIdx++),
		label: "Update All",
		action: () => {
			if (allCommand) shell.run(allCommand, { cwd: projectPath, label: "Documentation (all)" });
			for (const gen of configGenerators) {
				shell.run(gen.command, { cwd: projectPath, label: gen.label });
			}
			for (const doc of BUILTIN_DOCS) {
				const result = runReference(doc.generatorId, projectPath, createDefaultDeps());
				if (result && !result.success) {
					log(`  ${RED}${doc.label}: failed${RESET}`);
				} else {
					log(`  ${GREEN}${doc.label}: done${RESET}`);
				}
			}
			return "main" as const;
		},
	});

	items.push({ separator: true });

	for (const gen of configGenerators) {
		items.push({
			key: String(keyIdx++),
			label: gen.label,
			action: () => {
				shell.run(gen.command, { cwd: projectPath, label: gen.label });
				return "main" as const;
			},
		});
	}

	for (const doc of BUILTIN_DOCS) {
		items.push({
			key: String(keyIdx++),
			label: doc.label,
			action: () => {
				runReference(doc.generatorId, projectPath, createDefaultDeps());
				return "main" as const;
			},
		});
	}

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}

// ── Npm Scripts submenu ────────────────────────────────────────────

export function buildNpmScriptsSubmenu(
	projectPath: string,
	scripts: Record<string, string>,
): MenuEntry[] {
	const names = Object.keys(scripts);
	const items: MenuEntry[] = names.map((name, i) => ({
		key: String(i + 1),
		label: `npm run ${name}`,
		action: () => {
			shell.run(`npm run ${name}`, { cwd: projectPath, label: name });
		},
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}


// ── Dependencies submenu ────────────────────────────────────────────

export function buildDepsSubmenu(_projectPath: string): MenuEntry[] {
	return [
		{
			key: "1",
			label: "Show Dependency Graph",
			action: async () => {
				const graph = buildDependencyGraph();
				displayDependencyGraph(graph);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];
}

// ── Dev Tools submenu ───────────────────────────────────────────────

export function buildDevToolsSubmenu(
	projectPath: string,
	scripts: Record<string, string>,
): MenuEntry[] {
	const debugOn = (() => {
		const result = shell.runSilent("obsidian dev:debug status");
		return result !== null && result.toLowerCase().includes("on");
	})();
	return [
		{
			key: "1",
			label: "Type Check + Lint",
			action: () => {
				const cmd = scripts["check"] ? "npm run check" : "npx tsc --noEmit";
				shell.run(cmd, { cwd: projectPath, label: "Running lint + tsc..." });
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Lint Only",
			action: () => {
				const cmd = scripts["lint"] ? "npm run lint" : "npx eslint src/";
				shell.run(cmd, { cwd: projectPath, label: "Running ESLint..." });
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Reload Plugin",
			action: () => {
				shell.run("node scripts/cli-reload.mjs", { cwd: projectPath, label: "Reloading plugin..." });
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Dev Console",
			action: () => {
				const result = shell.runCaptureStatus("obsidian dev:console");
				if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
					log(`  ${DIM}Debugger not attached — enabling debug mode...${RESET}`);
					shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
					shell.run("obsidian dev:console", { label: "Opening dev console..." });
				}
				return "main" as const;
			},
		},
		...(debugOn ? [{
			key: "5",
			label: "Debug Off",
			action: () => {
				shell.run("obsidian dev:debug off", { label: "Disabling debug mode..." });
				return "main" as const;
			},
		}] as MenuEntry[] : []),
		{
			key: debugOn ? "6" : "5",
			label: "Rebuild CLI",
			action: async () => {
				const { rebuildCli } = await import("../domain/devtools/self-update.js");
				rebuildCli(projectPath, shell);
				return "main" as const;
			},
		},
		{ separator: true },
		{
			key: "n",
			label: "Npm Scripts",
			action: async () => {
				const { runMenu } = await import("../infrastructure/menu.js");
				await runMenu("npm scripts", buildNpmScriptsSubmenu(projectPath, scripts));
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];
}

// ── Export submenu (in export-submenu.ts) ────────────────────────────

export { buildExportSubmenu, buildScaffoldSubmenu } from "./export-submenu.js";
