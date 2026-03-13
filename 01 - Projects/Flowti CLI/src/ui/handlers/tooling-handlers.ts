/**
 * tooling-handlers.ts — Action handlers and list providers for make,
 * reports, docs, and devtools menus.
 *
 * Replaces the old view handlers and menu-builders.ts dynamic menu
 * construction with sitemap-driven action handlers + list providers.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuEntry, MakeTemplateId } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { createDefaultDeps } from "../../infrastructure/deps.js";
import { RESET, DIM, GREEN } from "../../infrastructure/ui.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { getReportsOutputDir } from "../../domain/project/project-config.js";
import { getAvailableTemplates as getAvailableTemplatesSync } from "../../domain/make/make-service.js";

// ── Make template registry ──────────────────────────────────────────

const TEMPLATE_LABELS: Record<MakeTemplateId, string> = {
	journey: "New E2E Journey",
	component: "Add Component",
};

// ── Registration ────────────────────────────────────────────────────

export function registerToolingHandlers(registry: HandlerRegistry): void {
	// ── Make: list provider ─────────────────────────────────────────

	registry.registerListProvider("make:templates", (ctx: RouterContext): MenuEntry[] => {
		if (!ctx.project) return [];
		const available = getAvailableTemplatesSync(ctx.project.path, { disk, paths });
		return available.map((id, i) => ({
			key: String(i + 1),
			label: TEMPLATE_LABELS[id] ?? id,
			action: async () => {
				if (id === "component") {
					const { componentMenu } = await import("../menus/component-makers-menu.js");
					await componentMenu(ctx.project!.path);
				} else if (id === "journey") {
					const { makeJourney } = await import("../menus/make-makers.js");
					await makeJourney(ctx.project!.path);
				}
				return undefined;
			},
		}));
	});

	registry.registerAction("make:help", async (_ctx) => {
		const { showHelp } = await import("../help.js");
		showHelp("make");
		await input.waitForEnter();
		return undefined;
	});

	// ── Reports: list provider + action handlers ────────────────────

	registry.registerListProvider("reports:generators", (ctx: RouterContext): MenuEntry[] => {
		if (!ctx.project) return [];
		const generators = ctx.project.config.reports?.generators ?? [];
		return generators.map((gen, i) => ({
			key: String(i + 2),
			label: gen.label,
			action: async () => {
				if (gen.id) {
					const { runGenerator } = await import("../../domain/reports/generator-registry.js");
					runGenerator(gen.id, ctx.project!.path, createDefaultDeps());
				} else if (gen.command) {
					shell.run(gen.command, { cwd: ctx.project!.path, label: gen.label });
				}
				await input.waitForEnter();
				return undefined;
			},
		}));
	});

	registry.registerAction("reports:run-all", async (ctx) => {
		if (!ctx.project) return undefined;
		const generators = ctx.project.config.reports?.generators ?? [];
		if (generators.length === 0) { log(`\n  ${DIM}No report generators configured.${RESET}\n`); await input.waitForEnter(); return undefined; }
		const { runAllReports } = await import("../../domain/reports/pipeline/report-runner.js");
		await runAllReports(generators, ctx.project.path, createDefaultDeps());
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("reports:export-html", async (ctx) => {
		if (!ctx.project) return undefined;
		const { ReportService } = await import("../../domain/reports/cli/report-service.js");
		const { exportReportToHtml } = await import("../../domain/reports/export/html-export.js");
		const svc = new ReportService(ctx.project.path, createDefaultDeps());
		const outputDir = paths.join(svc.reportsDir, "html");
		const entries = disk.readdirSync(svc.reportsDir).filter((f: string) => f.endsWith(".md"));
		if (entries.length === 0) { log(`\n  ${DIM}No report files found. Run reports first.${RESET}\n`); await input.waitForEnter(); return undefined; }
		let exported = 0;
		for (const entry of entries) {
			const result = exportReportToHtml(paths.join(svc.reportsDir, entry), outputDir, createDefaultDeps());
			if (result) { log(`  ${GREEN}✓${RESET} ${result.title} → ${DIM}${result.outputPath}${RESET}`); exported++; }
		}
		log(`\n  ${exported} report${exported !== 1 ? "s" : ""} exported to ${DIM}${outputDir}${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("reports:browse", async (ctx) => {
		if (!ctx.project) return undefined;
		const reportsDir = getReportsOutputDir(ctx.project.path, ctx.project.config, { paths });
		const { browseArchive } = await import("../menus/report-archive-menu.js");
		await browseArchive(reportsDir);
		return undefined;
	});

	// ── Docs: list providers + action handlers ──────────────────────

	registry.registerListProvider("docs:references", (ctx: RouterContext): MenuEntry[] => {
		if (!ctx.project) return [];
		const references = ctx.project.config.docs?.references ?? [];
		if (references.length === 0) return [];
		const referenceDir = paths.join(ctx.project.path, ctx.project.config.docs?.referenceDir ?? "docs/reference");
		return references.map((ref, i) => ({
			key: String(i + 2),
			label: `Open ${ref.label}`,
			action: async () => {
				const filePath = paths.join(referenceDir, `${ref.label}.md`);
				if (disk.existsSync(filePath)) {
					log(`\n${disk.readFileSync(filePath, "utf-8")}`);
				} else {
					log(`\n  ${DIM}${ref.label} not found. Run "Update References" first.${RESET}\n`);
				}
				await input.waitForEnter();
				return undefined;
			},
		}));
	});

	registry.registerListProvider("docs:generators", (ctx: RouterContext): MenuEntry[] => {
		if (!ctx.project) return [];
		const generators = ctx.project.config.docs?.generators ?? [];
		if (generators.length === 0) return [];
		const startKey = 20;
		return generators.map((gen, i) => ({
			key: String(startKey + i),
			label: gen.label,
			action: async () => {
				shell.run(gen.command, { cwd: ctx.project!.path, label: gen.label });
				await input.waitForEnter();
				return undefined;
			},
		}));
	});

	registry.registerAction("docs:update-refs", async (ctx) => {
		if (!ctx.project) return undefined;
		const references = ctx.project.config.docs?.references ?? [];
		if (references.length === 0) { log(`\n  ${DIM}No references configured.${RESET}\n`); await input.waitForEnter(); return undefined; }
		const { runAllDocs } = await import("../../domain/reports/pipeline/doc-runner.js");
		await runAllDocs([], references, ctx.project.path, createDefaultDeps());
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("docs:dependencies", async (_ctx) => {
		const { buildDependencyGraph } = await import("../../domain/project/project-deps.js");
		const { displayDependencyGraph } = await import("../displays/deps-display.js");
		const graph = buildDependencyGraph(PROJECTS_DIR, { disk, paths });
		displayDependencyGraph(graph);
		await input.waitForEnter();
		return undefined;
	});

	// ── DevTools: action handlers ───────────────────────────────────

	registry.registerAction("devtools:check", async (ctx) => {
		if (!ctx.project) return undefined;
		const scripts = ctx.project.scripts ?? {};
		const cmd = scripts["check"] ? "npm run check" : "npx tsc --noEmit";
		shell.run(cmd, { cwd: ctx.project.path, label: "Running lint + tsc..." });
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("devtools:lint", async (ctx) => {
		if (!ctx.project) return undefined;
		const scripts = ctx.project.scripts ?? {};
		const cmd = scripts["lint"] ? "npm run lint" : "npx eslint src/";
		shell.run(cmd, { cwd: ctx.project.path, label: "Running ESLint..." });
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("devtools:reload", async (ctx) => {
		if (!ctx.project) return undefined;
		shell.run("node scripts/cli-reload.mjs", { cwd: ctx.project.path, label: "Reloading plugin..." });
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("devtools:console", async (_ctx) => {
		const result = shell.runCaptureStatus("obsidian dev:console");
		if (result.exitCode !== 0 && result.output.includes("Debugger not attached")) {
			log(`  ${DIM}Debugger not attached — enabling debug mode...${RESET}`);
			shell.run("obsidian dev:debug on", { label: "Enabling debug mode..." });
			shell.run("obsidian dev:console", { label: "Opening dev console..." });
		}
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("devtools:rebuild", async (ctx) => {
		if (!ctx.project) return undefined;
		const { rebuildCli } = await import("../../domain/devtools/self-update.js");
		rebuildCli(ctx.project.path, shell);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("devtools:npm-scripts", async (ctx) => {
		if (!ctx.project) return undefined;
		const scripts = ctx.project.scripts ?? {};
		const names = Object.keys(scripts);
		if (names.length === 0) { log(`\n  ${DIM}No npm scripts found.${RESET}\n`); await input.waitForEnter(); return undefined; }
		const { runMenu } = await import("../../infrastructure/menu.js");
		const items: MenuEntry[] = names.map((name, i) => ({
			key: String(i + 1),
			label: `npm run ${name}`,
			action: () => { shell.run(`npm run ${name}`, { cwd: ctx.project!.path, label: name }); },
		}));
		items.push({ separator: true }, { key: "b", label: "Back", action: () => "main" as const });
		await runMenu("npm scripts", items);
		return undefined;
	});

	// ── Sitemap export ─────────────────────────────────────────────────────

	registry.registerAction("sitemap:export", async (ctx) => {
		if (!ctx.project) return undefined;
		const { exportSitemapToMarkdown } = await import("../../domain/sitemap/sitemap-export.js");
		const sitemapPath = paths.join(ctx.project.path, "configs", "sitemap.json");
		if (!disk.existsSync(sitemapPath)) {
			log(`
  ${DIM}No sitemap.json found.${RESET}
`);
			await input.waitForEnter();
			return undefined;
		}
		const sitemap = JSON.parse(disk.readFileSync(sitemapPath, "utf-8"));
		const outputDir = paths.join(ctx.project.path, "sitemap");
		const result = exportSitemapToMarkdown(sitemap, outputDir, { disk, paths });
		log(`
  ${GREEN}✓${RESET} Exported ${result.exported} views to ${DIM}${outputDir}${RESET}
`);
		await input.waitForEnter();
		return undefined;
	});
}
