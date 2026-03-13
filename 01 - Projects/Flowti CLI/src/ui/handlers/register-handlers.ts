/**
 * register-handlers.ts — Registers all sitemap handlers for the Flowti CLI.
 *
 * This is the single registration point for view handlers, action handlers,
 * condition handlers, and beforeRender handlers used by the SitemapRouter.
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
import { PROJECTS_DIR, VAULT_ROOT } from "../../infrastructure/config.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";
import { collectHealth } from "../../domain/health/health.js";
import { displayHealth } from "../health-display.js";
import { showHelp } from "../help.js";
import { showInfo } from "../info-display.js";
import { printProjectStatusBanner } from "../project-status-banner.js";
import { buildWithReport } from "../../domain/reports/cli/generate-build-report.js";
import { registerCrudHandlers } from "./crud-handlers.js";
import { registerExtensibilityHandlers } from "./extensibility-handlers.js";
import { registerDevelopmentHandlers } from "./development-handlers.js";
import { registerPipelineHandlers } from "./pipeline-handlers.js";
import { registerToolingHandlers } from "./tooling-handlers.js";
import { registerComponentHandlers } from "./component-handlers.js";

export function registerAllHandlers(registry: HandlerRegistry): void {
	registerCrudHandlers(registry);
	registerExtensibilityHandlers(registry);
	registerDevelopmentHandlers(registry);
	registerPipelineHandlers(registry);
	registerToolingHandlers(registry);
	registerComponentHandlers(registry);

	// ── BeforeRender handlers ───────────────────────────────────────

	registry.registerBeforeRender("start:banner", (ctx) => {
		const current = getSelectedProject();
		const projects = listProjects(PROJECTS_DIR, { disk });
		if (current) {
			log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
		} else if (projects.length === 0) {
			log(`  ${DIM}No projects yet. Create one to get started.${RESET}\n`);
		}
	});

	registry.registerBeforeRender("project:banner", (_ctx) => {
		clearScreen();
		const project = getSelectedProject();
		const ctx = project ? initializeProject(project, PROJECTS_DIR, { disk, paths }) : null;
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
		return !getSelectedProject();
	});

	registry.registerCondition("knowledgebase:available", (_ctx) => {
		return !isKnowledgebaseAvailable(VAULT_ROOT, { disk, paths, shell });
	});

	registry.registerCondition("readme:exists", (ctx) => {
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

	// ── View handlers (remaining dynamic menus) ─────────────────────

	registry.registerView("components", async (ctx) => {
		if (!ctx.project) return "main";
		const { componentListMenu } = await import("../menus/component-list-menu.js");
		return componentListMenu(ctx.project.path, ctx.project.config.components, ctx.sitemapSlots);
	});

	registry.registerView("knowledgebase", async (_ctx) => {
		const { knowledgebaseMenu } = await import("../menus/knowledgebase-menu.js");
		return knowledgebaseMenu();
	});

	registry.registerView("component-detail", async (ctx) => {
		if (!ctx.project) return "main";
		const componentName = ctx.params?.componentName as string | undefined;
		if (!componentName) return "main";
		const { componentDetailMenu } = await import("../menus/component-detail-menu.js");
		const { listProjectComponents } = await import("../menus/component-list-menu.js");
		const allComponents = listProjectComponents(ctx.project.path, { disk, paths });
		const component = allComponents.find((c) => c.name === componentName);
		if (!component) return "main";
		return componentDetailMenu(ctx.project.path, component, allComponents, ctx.sitemapSlots);
	});
}
