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
import { isDashboardRunning, stopDashboard, getDashboardState } from "../../domain/serve/dashboard-service.js";
import { renderPlanningHeader } from "../displays/iterations-display.js";
import { YELLOW } from "../../infrastructure/ui.js";
import { cliConfig } from "../../infrastructure/config.js";
import { agentStore } from "../../domain/agents/agent-store.js";
import { registerCrudHandlers } from "./crud-handlers.js";
import { registerExtensibilityHandlers } from "./extensibility-handlers.js";
import { registerDevelopmentHandlers } from "./development-handlers.js";
import { registerPipelineHandlers } from "./pipeline-handlers.js";
import { registerToolingHandlers } from "./tooling-handlers.js";
import { registerComponentHandlers } from "./component-handlers.js";
import { registerOnboardingHandlers } from "./onboarding-handlers.js";
import { registerWorkspaceHandlers } from "./workspace-handlers.js";
import { registerChatHandlers } from "./chat-handlers.js";

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

interface WorkingAgent { name: string; persona?: string; status: string; task?: string; lastType?: string; question?: string }

function parseAgentFile(
	deps: Pick<CliDeps, "disk" | "paths">,
	varDir: string,
	file: string,
	agents: ReadonlyArray<{ name: string; persona?: string }>,
): WorkingAgent | null {
	const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
	const state = JSON.parse(content) as { name?: string; status?: string; tasks?: Array<{ name: string; status: string }>; lastInteractionType?: string };
	if (state.status !== "busy" && state.status !== "waiting") return null;
	const activeTask = state.tasks?.find((t) => t.status === "pending" || t.status === "in-progress");
	const agentDef = agents.find((a) => a.name === state.name);
	const pq = (state as Record<string, unknown>).pendingQuestion as { question?: string } | undefined;
	return { name: state.name ?? file, persona: agentDef?.persona, status: state.status, task: activeTask?.name, lastType: state.lastInteractionType, question: pq?.question };
}

function parseAgentStates(deps: Pick<CliDeps, "disk" | "paths">, varDir: string): WorkingAgent[] {
	const agentFiles = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
	let agents: Array<{ name: string; persona?: string }> = [];
	try { agents = agentStore.list(deps, VAULT_ROOT, cliConfig.agents ? { dir: cliConfig.agents.dir } : undefined); } catch { /* best-effort */ }
	return agentFiles.map((file) => parseAgentFile(deps, varDir, file, agents)).filter((a): a is WorkingAgent => a !== null);
}

function formatAgentTaskInfo(a: WorkingAgent): string {
	if (a.status === "waiting" && a.question) return ` — ${a.question.slice(0, 50)}`;
	if (a.task) return ` — ${a.task}`;
	if (a.lastType) return ` — last: ${a.lastType}`;
	return "";
}

function renderBusyAgents(deps: Pick<CliDeps, "disk" | "paths" | "log">): void {
	const varDir = deps.paths.join(VAULT_ROOT, ".flowti", "var");
	if (!deps.disk.existsSync(varDir)) return;
	try {
		const working = parseAgentStates(deps, varDir);
		if (working.length === 0) return;
		deps.log(`  ${YELLOW}Agents:${RESET}`);
		for (const a of working) {
			const displayName = a.persona ? `${a.persona} (${a.name})` : a.name;
			const statusTag = a.status === "busy" ? `${YELLOW}working${RESET}` : `${CYAN}waiting${RESET}`;
			deps.log(`    ${CYAN}${displayName}${RESET} ${DIM}[${statusTag}${DIM}]${formatAgentTaskInfo(a)}${RESET}`);
		}
		deps.log("");
	} catch { /* state read best-effort */ }
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
	registerOnboardingHandlers(registry);
	registerWorkspaceHandlers(registry);
	registerChatHandlers(registry);

	// ── BeforeRender handlers ───────────────────────────────────────

	registry.registerBeforeRender("start:banner", (ctx) => {
		const current = getSelectedProject();
		const projects = listProjects(PROJECTS_DIR, { disk: ctx.deps.disk });
		if (current) {
			ctx.deps.log(`  ${DIM}Current project: ${CYAN}${current}${RESET}\n`);
		} else if (projects.length === 0) {
			ctx.deps.log(`  ${DIM}No projects yet. Create one to get started.${RESET}\n`);
		}
		// Show busy agents on the start banner
		renderBusyAgents(ctx.deps);
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

	registry.registerCondition("agents:dashboard-running", (_ctx) => {
		return isDashboardRunning();
	});

	registry.registerCondition("agents:dashboard-not-running", (_ctx) => {
		return !isDashboardRunning();
	});

	// ── Agent dashboard handlers ─────────────────────────────────────

	registry.registerAction("agents:start-dashboard", async (ctx) => {
		const { log, input } = ctx.deps;
		if (isDashboardRunning()) {
			const state = getDashboardState();
			log(`\n  Dashboard already running at ${state?.url}\n`);
			await input.waitForEnter();
			return undefined;
		}
		const agentsConfig = ctx.project?.config.agents;
		if (!agentsConfig?.dashboard) {
			log("\n  Agent dashboard is not enabled for this project.");
			const answer = await input.ask("  Enable it now? (y/n)", "y");
			if (answer.toLowerCase() !== "y") return undefined;
			const { updateProjectConfig } = await import("../../domain/project/project-config.js");
			if (ctx.project) {
				updateProjectConfig(ctx.project.path, ctx.deps, (cfg) => {
					if (!cfg.agents) cfg.agents = {};
					cfg.agents.dashboard = true;
					cfg.agents.dashboardDir = cfg.agents.dashboardDir ?? "agents";
				});
				ctx.project.config.agents = { dashboard: true, dashboardDir: "agents", ...ctx.project.config.agents };
				log("  Enabled agents.dashboard in flowti.config.json.\n");
			}
		}
		const { VAULT_ROOT, PROJECTS_DIR, CLI_PROJECT, cliConfig } = await import("../../infrastructure/config.js");
		const { startDashboardServer } = await import("../../domain/serve/dashboard-service.js");
		const state = await startDashboardServer({
			port: 3000,
			rootDir: ctx.deps.paths.resolve(".flowti/agents"),
			cliProjectPath: CLI_PROJECT,
			projectsDir: PROJECTS_DIR,
			vaultRoot: VAULT_ROOT,
			projectConfig: ctx.project?.config,
			vaultAgentsConfig: cliConfig.agents,
		}, ctx.deps);
		if (state) log(`\n  Dashboard running at: ${state.url}\n`);
		await input.waitForEnter();
		return undefined;
	});

	registry.registerAction("agents:stop-dashboard", async (ctx) => {
		const { log, input } = ctx.deps;
		stopDashboard(log);
		await input.waitForEnter();
		return undefined;
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

	registry.registerAction("project:manage-agents", async (ctx) => {
		if (!ctx.project) return undefined;
		const { manageProjectAgentsInteractive } = await import("../menus/agents-menu.js");
		const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
		await manageProjectAgentsInteractive(ctx.project.path, ctx.project.config, VAULT_ROOT, cliConfig.agents, ctx.deps);
		await ctx.deps.input.waitForEnter();
		return undefined;
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
		const { watchFile } = await import("../../infrastructure/filesystem.js");
		const config = ctx.project.config.management?.iterations;
		const targetNum = ctx.params?.iterationNumber as number | undefined;
		const iterNum = resolveIterationNumber(ctx.project.path, config, ctx.deps, targetNum);
		if (!iterNum) return "main";
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, config) ?? undefined;
		return iterationDetailMenu(ctx.project.path, iterNum, config, ctx.dataSourceEntries, ctx.deps, { template, watchFn: watchFile });
	});

	// ── Inbox: agent notes on start page ─────────────────────────────

	registry.registerDataSource("inbox:agent-notes", (ctx): import("../../infrastructure/types.js").MenuEntry[] => {
		const inboxDir = ctx.deps.paths.join(VAULT_ROOT, "00 - Connectivity", "inbox");
		if (!ctx.deps.disk.existsSync(inboxDir)) return [];
		try {
			const files = ctx.deps.disk.readdirSync(inboxDir).filter((f) => f.endsWith(".md"));
			const notes: Array<{ file: string; persona: string; date: string }> = [];
			for (const file of files) {
				const content = ctx.deps.disk.readFileSync(ctx.deps.paths.join(inboxDir, file), "utf-8");
				if (!content.includes("type: agent-note")) continue;
				if (content.includes("read: true")) continue;
				const personaMatch = content.match(/^persona:\s*(.+)$/m);
				const dateMatch = content.match(/^date:\s*(.+)$/m);
				if (personaMatch) notes.push({ file, persona: personaMatch[1], date: dateMatch?.[1] ?? "" });
			}
			const noteKeys = "nmlkjihgf";
			return notes.map((n, i) => ({
				key: noteKeys[i] ?? String(i + 1),
				label: `${CYAN}Note from ${n.persona}${RESET} ${DIM}${n.date ? `(${new Date(n.date).toLocaleString()})` : ""}${RESET}`,
				group: "inbox",
				action: async () => {
					const filePath = ctx.deps.paths.join(inboxDir, n.file);
					const content = ctx.deps.disk.readFileSync(filePath, "utf-8");
					const body = content.replace(/^---[\s\S]*?---\s*/, "");
					ctx.deps.log("");
					for (const line of body.trim().split("\n")) ctx.deps.log(`  ${line}`);
					ctx.deps.log("");
					const updated = content.replace(/^(---\r?\n)/, "$1read: true\n");
					ctx.deps.disk.writeFileSync(filePath, updated, "utf-8");
					ctx.deps.log(`  ${DIM}Note marked as read.${RESET}\n`);
					await ctx.deps.input.waitForEnter();
					return "navigate:start" as import("../../infrastructure/types.js").MenuResult;
				},
			}));
		} catch { return []; }
	});
}
