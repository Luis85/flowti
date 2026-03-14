/**
 * register-handlers.ts — Registers all sitemap handlers for the Flowti CLI.
 *
 * This is the single registration point for view handlers, action handlers,
 * condition handlers, and beforeRender handlers used by the SitemapRouter.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

import { clearScreen, RESET, DIM, CYAN, GREEN } from "../../infrastructure/ui.js";
import { PROJECTS_DIR, VAULT_ROOT } from "../../infrastructure/config.js";
import { getSelectedProject } from "../../infrastructure/state.js";
import { initializeProject } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";
import { collectHealth } from "../../domain/health/health.js";
import { displayHealth } from "../displays/health-display.js";
import { showHelp } from "../help.js";
import { showInfo } from "../displays/info-display.js";
import { printProjectStatusBanner } from "../renderers/project-status-banner.js";
import { buildWithReport } from "../../domain/reports/cli/generate-build-report.js";
import { findCurrentIteration } from "../../domain/iterations/iteration-store.js";
import { renderPlanningHeader } from "../displays/iterations-display.js";
import { registerCrudHandlers } from "./crud-handlers.js";
import { registerExtensibilityHandlers } from "./extensibility-handlers.js";
import { registerDevelopmentHandlers } from "./development-handlers.js";
import { registerPipelineHandlers } from "./pipeline-handlers.js";
import { registerToolingHandlers } from "./tooling-handlers.js";
import { registerComponentHandlers } from "./component-handlers.js";

function renderIterationBannerLine(projectPath: string, config: import("../../infrastructure/types.js").ManagementConfig | undefined, deps: Pick<CliDeps, "disk" | "paths" | "clock" | "log">): void {
	const iter = findCurrentIteration({ disk: deps.disk, paths: deps.paths, clock: deps.clock }, projectPath, config?.iterations);
	if (iter) deps.log(`  ${DIM}Iteration:${RESET} ${GREEN}${iter.name}${RESET} ${DIM}[${iter.status}]${RESET}`);
}

function renderProjectContext(ctx: import("../../infrastructure/types.js").ProjectContext, deps: Pick<CliDeps, "disk" | "paths" | "clock" | "log">): void {
	deps.log(`  ${DIM}Project:${RESET} ${CYAN}${ctx.config.name}${RESET}`);
	if (ctx.pkg) {
		deps.log(`  ${DIM}${ctx.pkg.name ?? ""}@${ctx.pkg.version ?? "?"}${RESET}`);
	}
	printProjectStatusBanner(deps, ctx);
	renderIterationBannerLine(ctx.path, ctx.config.management, deps);
}

function renderProjectBanner(deps: Pick<CliDeps, "disk" | "paths" | "clock" | "log">): void {
	clearScreen();
	const project = getSelectedProject();
	const ctx = project ? initializeProject(project, PROJECTS_DIR, { disk: deps.disk, paths: deps.paths }) : null;
	if (ctx) renderProjectContext(ctx, deps);
	else deps.log(`  ${DIM}Project:${RESET} ${CYAN}${project ?? "Unknown"}${RESET}`);
	deps.log("");
}

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
		const projects = listProjects(PROJECTS_DIR, { disk: ctx.deps.disk });
		if (current) {
			ctx.deps.log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
		} else if (projects.length === 0) {
			ctx.deps.log(`  ${DIM}No projects yet. Create one to get started.${RESET}\n`);
		}
	});

	registry.registerBeforeRender("project:banner", (ctx) => renderProjectBanner(ctx.deps));

	registry.registerBeforeRender("planning:header", (ctx) => {
		if (!ctx.project) return;
		const config = ctx.project.config.management?.iterations;
		const iter = findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, config);
		if (iter) renderPlanningHeader(iter, ctx.deps.log);
	});

	// ── Condition handlers ──────────────────────────────────────────

	registry.registerCondition("no-project-selected", (_ctx) => {
		return !getSelectedProject();
	});

	registry.registerCondition("knowledgebase:available", (ctx) => {
		return !isKnowledgebaseAvailable(VAULT_ROOT, { disk: ctx.deps.disk, paths: ctx.deps.paths, shell: ctx.deps.shell });
	});

	registry.registerCondition("readme:exists", (ctx) => {
		if (!ctx.project) return true;
		return !ctx.deps.disk.existsSync(ctx.deps.paths.join(ctx.project.path, "README.md"));
	});

	registry.registerCondition("iteration:running", (ctx) => {
		if (!ctx.project) return false;
		return !!findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, ctx.project.config.management?.iterations);
	});

	registry.registerCondition("iteration:not-running", (ctx) => {
		if (!ctx.project) return true;
		return !findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, ctx.project.config.management?.iterations);
	});

	registry.registerCondition("iteration:not-planned", (ctx) => {
		if (!ctx.project) return true;
		const current = findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, ctx.project.config.management?.iterations);
		return !current || current.status !== "planned";
	});

	registry.registerCondition("iteration:cannot-advance", (ctx) => {
		if (!ctx.project) return true;
		const current = findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, ctx.project.config.management?.iterations);
		return !current || current.status === "done" || current.status === "cancelled";
	});

	registry.registerCondition("iteration:not-in-review", (ctx) => {
		if (!ctx.project) return true;
		const current = findCurrentIteration({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, ctx.project.path, ctx.project.config.management?.iterations);
		return !current || current.status !== "in-review";
	});

	// ── Action handlers (project-detail items) ──────────────────────

	registry.registerAction("project:open", async (ctx) => {
		const { openProjectHandler } = await import("./start-handlers.js");
		return openProjectHandler(ctx.deps);
	});

	registry.registerAction("project:create", async (ctx) => {
		const { createProjectHandler } = await import("./start-handlers.js");
		return createProjectHandler(ctx.deps);
	});

	registry.registerAction("capture:idea", async (ctx) => {
		const { captureIdea } = await import("../menus/capture-menu.js");
		return captureIdea(ctx.deps);
	});

	registry.registerAction("capture:note", async (ctx) => {
		const { captureNote } = await import("../menus/capture-menu.js");
		return captureNote(ctx.deps);
	});

	registry.registerAction("capture:bug", async (ctx) => {
		const { captureBug } = await import("../menus/capture-menu.js");
		return captureBug(ctx.deps);
	});

	registry.registerAction("build:interactive", async (ctx) => {
		if (!ctx.project) return undefined;
		const buildCmd = ctx.project.config.build?.commands?.["fast"];
		if (!buildCmd) return undefined;
		const { disk, paths, clock, shell, log, input } = ctx.deps;
		buildWithReport(buildCmd, ctx.project.path, { disk, paths, clock, shell, log });
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("health:show", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, shell, input } = ctx.deps;
		const health = collectHealth({ disk, paths, shell }, ctx.project);
		displayHealth(health, ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("help:main", async (ctx) => {
		showHelp("main", ctx.deps);
		const { input } = ctx.deps;
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("info:show", async (ctx) => {
		showInfo(ctx.deps);
		const { input } = ctx.deps;
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("readme:show", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input, log } = ctx.deps;
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
		return componentListMenu(ctx.project.path, ctx.project.config.components, ctx.dataSourceEntries, ctx.deps);
	});

	registry.registerView("knowledgebase", async (ctx) => {
		const { knowledgebaseMenu } = await import("../menus/knowledgebase-menu.js");
		return knowledgebaseMenu(ctx.deps);
	});

	registry.registerView("component-detail", async (ctx) => {
		if (!ctx.project) return "main";
		const componentName = ctx.params?.componentName as string | undefined;
		if (!componentName) return "main";
		const { componentDetailMenu } = await import("../menus/component-detail-menu.js");
		const { listProjectComponents } = await import("../menus/component-list-menu.js");
		const allComponents = listProjectComponents(ctx.project.path, { disk: ctx.deps.disk, paths: ctx.deps.paths });
		const component = allComponents.find((c) => c.name === componentName);
		if (!component) return "main";
		return componentDetailMenu(ctx.project.path, component, allComponents, ctx.dataSourceEntries, ctx.deps);
	});

	registry.registerView("iteration-detail", async (ctx) => {
		if (!ctx.project) return "main";
		const { iterationDetailMenu, resolveIterationNumber } = await import("../menus/iteration-detail-menu.js");
		const { loadIterationTemplate } = await import("./iteration-template-loader.js");
		const config = ctx.project.config.management?.iterations;
		const targetNum = ctx.params?.iterationNumber as number | undefined;
		const iterNum = resolveIterationNumber(ctx.project.path, config, ctx.deps, targetNum);
		if (!iterNum) return "main";
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, config) ?? undefined;
		return iterationDetailMenu(ctx.project.path, iterNum, config, ctx.dataSourceEntries, ctx.deps, template);
	});
}
