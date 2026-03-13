/**
 * register-handlers.ts — Registers all sitemap handlers for the Flowti CLI.
 *
 * This is the single registration point for view handlers, action handlers,
 * condition handlers, and beforeRender handlers used by the SitemapRouter.
 *
 * View handlers wrap existing menu functions.
 * Action handlers wrap inline menu actions.
 * Condition handlers evaluate disabled/hidden state.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { clearScreen, RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject, getReportsDir } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";
import { collectHealth } from "../../domain/health/health.js";
import { displayHealth } from "../health-display.js";
import { showHelp } from "../help.js";
import { showInfo } from "../info-display.js";
import { printProjectStatusBanner } from "../project-status-banner.js";
import { buildWithReport } from "../../domain/reports/cli/generate-build-report.js";
import { buildReportsSubmenu, buildDocsSubmenu, buildDevToolsSubmenu } from "../menu-builders.js";

export function registerAllHandlers(registry: HandlerRegistry): void {
	// ── BeforeRender handlers ───────────────────────────────────────

	registry.registerBeforeRender("start:banner", (ctx) => {
		const current = getSelectedProject();
		const projects = listProjects({ disk });
		if (current) {
			log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
		} else if (projects.length === 0) {
			log(`  ${DIM}No projects yet. Create one to get started.${RESET}\n`);
		}
	});

	registry.registerBeforeRender("project:banner", (_ctx) => {
		clearScreen();
		const project = getSelectedProject();
		const ctx = project ? initializeProject(project, { disk, paths }) : null;
		const label = ctx?.config.name ?? project ?? "Unknown";
		log(`  ${DIM}Project:${RESET} ${CYAN}${label}${RESET}`);
		if (ctx?.pkg) {
			log(`  ${DIM}${ctx.pkg.name ?? ""}@${ctx.pkg.version ?? "?"}${RESET}`);
		}
		if (ctx) printProjectStatusBanner(ctx);
		log();
	});

	// ── Condition handlers ──────────────────────────────────────────

	registry.registerCondition("no-project-selected", (_ctx) => {
		// Returns true when HIDDEN (no project selected)
		return !getSelectedProject();
	});

	registry.registerCondition("knowledgebase:available", (_ctx) => {
		// Returns true when DISABLED (no knowledgebase)
		return !isKnowledgebaseAvailable({ disk, paths, shell });
	});

	registry.registerCondition("readme:exists", (ctx) => {
		// Returns true when DISABLED (no README)
		if (!ctx.project) return true;
		return !disk.existsSync(paths.join(ctx.project.path, "README.md"));
	});

	// ── Action handlers (project-detail items) ──────────────────────

	registry.registerAction("project:open", async (_ctx) => {
		const { openProjectHandler } = await import("./start-handlers.js");
		return openProjectHandler();
	});

	registry.registerAction("project:create", async (_ctx) => {
		const { createProjectHandler } = await import("./start-handlers.js");
		return createProjectHandler();
	});

	registry.registerAction("capture:idea", async (_ctx) => {
		const { captureIdea } = await import("../menus/capture-menu.js");
		return captureIdea();
	});

	registry.registerAction("capture:note", async (_ctx) => {
		const { captureNote } = await import("../menus/capture-menu.js");
		return captureNote();
	});

	registry.registerAction("capture:bug", async (_ctx) => {
		const { captureBug } = await import("../menus/capture-menu.js");
		return captureBug();
	});

	registry.registerAction("build:interactive", async (ctx) => {
		if (!ctx.project) return undefined;
		const buildCmd = ctx.project.config.build?.commands?.["fast"];
		if (!buildCmd) return undefined;
		buildWithReport(buildCmd, ctx.project.path, { disk, paths, clock, shell, log });
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("health:show", async (ctx) => {
		if (!ctx.project) return undefined;
		const health = collectHealth({ disk, paths, shell }, ctx.project);
		displayHealth(health);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("help:main", async (_ctx) => {
		showHelp("main");
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("info:show", async (_ctx) => {
		showInfo();
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("readme:show", async (ctx) => {
		if (!ctx.project) return undefined;
		const readmePath = paths.join(ctx.project.path, "README.md");
		if (!disk.existsSync(readmePath)) return undefined;
		const content = disk.readFileSync(readmePath, "utf-8");
		log(`\n${content}`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── View handlers (dynamic menus) ───────────────────────────────

	registry.registerView("plugins", async (_ctx) => {
		const { pluginsMenu } = await import("../menus/plugins-menu.js");
		return pluginsMenu();
	});

	registry.registerView("ai-tools", async (_ctx) => {
		const { aiToolsMenu } = await import("../menus/ai-tools-menu.js");
		return aiToolsMenu();
	});

	registry.registerView("make", async (ctx) => {
		if (!ctx.project) return "main";
		const { menu } = await import("../menus/make-menu.js");
		return menu(ctx.project.path);
	});

	registry.registerView("review", async (ctx) => {
		if (!ctx.project) return "main";
		const { reviewMenu } = await import("../menus/review-menu.js");
		return reviewMenu(ctx.project.path, ctx.project.config.review ?? {});
	});

	registry.registerView("publish", async (ctx) => {
		if (!ctx.project) return "main";
		const { publishMenu } = await import("../menus/publish-menu.js");
		return publishMenu(ctx.project.path, ctx.project.config.publish ?? {});
	});

	registry.registerView("components", async (ctx) => {
		if (!ctx.project) return "main";
		const { componentListMenu } = await import("../menus/component-list-menu.js");
		return componentListMenu(ctx.project.path, ctx.project.config.components);
	});

	registry.registerView("reports", async (ctx) => {
		if (!ctx.project) return "main";
		const { runMenu } = await import("../../infrastructure/menu.js");
		const generators = ctx.project.config.reports?.generators ?? [];
		const reportsDir = getReportsDir(ctx.project.path, ctx.project.config, { paths });
		await runMenu("reports", buildReportsSubmenu(generators, ctx.project.path, reportsDir));
		return "main" as MenuResult;
	});

	registry.registerView("requirements", async (ctx) => {
		if (!ctx.project) return "main";
		const { requirementsMenu } = await import("../menus/requirements-menu.js");
		return requirementsMenu(ctx.project.path, ctx.project.config.management?.requirements);
	});

	registry.registerView("docs", async (ctx) => {
		if (!ctx.project) return "main";
		const { runMenu } = await import("../../infrastructure/menu.js");
		const docsConfig = ctx.project.config.docs;
		const configGens = docsConfig?.generators ?? [];
		const references = docsConfig?.references ?? [];
		await runMenu("documentation", buildDocsSubmenu(configGens, references, ctx.project.path), { defaultChoice: "1" });
		return "main" as MenuResult;
	});

	registry.registerView("knowledgebase", async (_ctx) => {
		const { knowledgebaseMenu } = await import("../menus/knowledgebase-menu.js");
		return knowledgebaseMenu();
	});

	registry.registerView("devtools", async (ctx) => {
		if (!ctx.project) return "main";
		const { runMenu } = await import("../../infrastructure/menu.js");
		await runMenu("dev tools", buildDevToolsSubmenu(ctx.project.path, ctx.project.scripts));
		return "main" as MenuResult;
	});

	registry.registerView("resources", async (ctx) => {
		if (!ctx.project) return "main";
		const { resourcesMenu } = await import("../menus/resources-menu.js");
		return resourcesMenu(ctx.project.path, ctx.project.config.management?.resources);
	});

	registry.registerView("timelog", async (ctx) => {
		if (!ctx.project) return "main";
		const { timelogMenu } = await import("../menus/timelog-menu.js");
		return timelogMenu(ctx.project.path, ctx.project.config.management?.timelog);
	});

	registry.registerView("deliverables", async (ctx) => {
		if (!ctx.project) return "main";
		const { deliverablesMenu } = await import("../menus/deliverables-menu.js");
		return deliverablesMenu(ctx.project.path, ctx.project.config.management?.deliverables);
	});

	registry.registerView("raid", async (ctx) => {
		if (!ctx.project) return "main";
		const { raidMenu } = await import("../menus/raid-menu.js");
		return raidMenu(ctx.project.path, ctx.project.config.management?.raid);
	});

	registry.registerView("capa", async (ctx) => {
		if (!ctx.project) return "main";
		const { capaMenu } = await import("../menus/capa-menu.js");
		return capaMenu(ctx.project.path, ctx.project.config.management?.capa);
	});

	registry.registerView("lifecycle", async (ctx) => {
		if (!ctx.project) return "main";
		const { projectLifecycleMenu } = await import("../menus/project-lifecycle-menu.js");
		return projectLifecycleMenu(ctx.project);
	});
}
