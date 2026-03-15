/** extensibility-handlers.ts — Action handlers for plugins and AI tools menus. */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";
import { RESET, DIM, GREEN, RED, BOLD } from "../../infrastructure/ui.js";
import { VAULT_ROOT, CLI_PROJECT, cliConfig } from "../../infrastructure/config.js";
import { navigateWithParams } from "../../infrastructure/sitemap-router.js";
import { listAgents } from "../../domain/agents/agent-store.js";
import { buildTaskMenuItems, showTaskActions } from "./agent-task-handlers.js";
import { loadPlugins, scaffoldPlugin } from "../../domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../domain/plugins/plugin-reference.js";
import { toPluginListItems, toPluginValidationItems } from "../../domain/plugins/plugin-commands.js";
import { renderPluginList, renderPluginValidation } from "../displays/plugins-display.js";
import { loadAiTools, scaffoldAiTool } from "../../domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../domain/ai-tools/ai-tool-reference.js";
import { toToolListItems, toToolValidationItems } from "../../domain/ai-tools/ai-tool-commands.js";
import { renderToolList, renderToolValidation } from "../displays/ai-tools-display.js";
import { syncAgentsToClaude, syncToolsToClaude } from "../../domain/claude-sync/claude-sync.js";

function varDir(ctx: RouterContext): string {
	return ctx.deps.paths.join(VAULT_ROOT, ".flowti", "var");
}

async function persistInteraction(
	agent: import("../../domain/agents/agent-types.js").AgentSummary,
	type: import("../../domain/agents/agent-state.js").AgentInteractionType,
	ctx: RouterContext,
	taskName?: string,
): Promise<void> {
	const { readAgentState, writeAgentState, recordInteraction, addTask } = await import("../../domain/agents/agent-state.js");
	const dir = varDir(ctx);
	let state = readAgentState(ctx.deps, dir, agent.name);
	state = recordInteraction(state, type, ctx.deps.clock.iso());
	if (type === "task" && taskName) {
		const iterNum = await resolveIterationNumber(ctx);
		state = addTask(state, { name: taskName, assignedAt: ctx.deps.clock.iso(), status: "pending", iterationNumber: iterNum });
	}
	writeAgentState(ctx.deps, dir, agent.name, state);
	ctx.deps.log(`\n  ${GREEN}${agent.name}${RESET} ${DIM}[${type}] state saved${RESET}`);
}

async function resolveIterationNumber(ctx: RouterContext): Promise<number | undefined> {
	if (!ctx.project) return undefined;
	try {
		const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
		const current = findCurrentIteration(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations);
		return current?.number;
	} catch { return undefined; }
}

async function recordBriefState(ctx: RouterContext, agent: import("../../domain/agents/agent-types.js").AgentSummary, iterDir: string, autonomous: boolean): Promise<void> {
	const { readAgentState, writeAgentState, addBrief } = await import("../../domain/agents/agent-state.js");
	const vDir = varDir(ctx);
	const state = readAgentState(ctx.deps, vDir, agent.name);
	const briefPath = ctx.deps.paths.join(iterDir, "briefs");
	writeAgentState(ctx.deps, vDir, agent.name, addBrief(state, { path: briefPath, generatedAt: ctx.deps.clock.iso(), autonomous }));
}

function agentStateFilePath(ctx: RouterContext, agentName: string): string {
	const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
	return ctx.deps.paths.join(varDir(ctx), `data-${slug}.json`);
}

function resolveAgentSkills(domain: string | undefined): readonly string[] | undefined {
	return cliConfig.agents?.skillMap?.[domain ?? ""];
}

async function runAgentAfterInteraction(agent: import("../../domain/agents/agent-types.js").AgentSummary, ctx: RouterContext): Promise<void> {
	if (!ctx.project) return;
	const iterCfg = ctx.project.config.management?.iterations;
	try {
		const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
		const iteration = findCurrentIteration(ctx.deps, ctx.project.path, iterCfg);
		if (!iteration) return;
		const iterDir = ctx.deps.paths.join(ctx.project.path, iterCfg?.dir ?? "iterations");
		const autonomous = cliConfig.agents?.autonomous === true;
		const { runAgentInteractive } = await import("../menus/agents-run-menu.js");
		await runAgentInteractive(agent, iteration, iterDir, autonomous, ctx.deps, agentStateFilePath(ctx, agent.name), resolveAgentSkills(agent.domain));
		await recordBriefState(ctx, agent, iterDir, autonomous);
	} catch { /* iteration store not available */ }
}

async function buildTaskContext(ctx: RouterContext): Promise<import("../menus/agents-interact-menu.js").TaskContext | undefined> {
	if (!ctx.project) return undefined;
	const result: import("../menus/agents-interact-menu.js").TaskContext = { projectName: ctx.project.config.name };
	try {
		const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
		const current = findCurrentIteration(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations);
		if (current) return { ...result, iterationFile: current.file, iterationNumber: current.number };
	} catch { /* iteration store not available */ }
	return result;
}

function maybeSyncAgents(ctx: RouterContext): void {
	if (cliConfig.agents?.claudeSync !== true) return;
	const agentsDir = ctx.deps.paths.join(VAULT_ROOT, cliConfig.agents?.dir ?? "docs/agents");
	const agents = listAgents(ctx.deps, VAULT_ROOT, cliConfig.agents);
	syncAgentsToClaude(ctx.deps, VAULT_ROOT, agentsDir, agents, cliConfig.agents?.skillMap);
}

function maybeSyncTools(ctx: RouterContext): void {
	if (cliConfig.agents?.claudeSync !== true) return;
	const tools = loadAiTools(ctx.deps, VAULT_ROOT, ctx.deps.disk);
	syncToolsToClaude(ctx.deps, VAULT_ROOT, tools);
}

async function withAgent(ctx: RouterContext, fn: (agent: import("../../domain/agents/agent-types.js").AgentSummary) => Promise<MenuResult | undefined>): Promise<MenuResult | undefined> {
	const agentName = ctx.params?.agentName as string | undefined;
	if (!agentName) return undefined;
	const { findAgent } = await import("../../domain/agents/agent-store.js");
	const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	if (!agent) return undefined;
	return fn(agent);
}

function renderGrantsList(grants: readonly import("../../domain/agents/permission-engine.js").PermissionGrant[], pending: readonly import("../../domain/agents/agent-state.js").PendingPermission[], log: (msg?: string) => void): void {
	if (grants.length > 0) {
		log(`\n  ${BOLD}Permanent grants${RESET}\n`);
		for (let i = 0; i < grants.length; i++) {
			log(`  ${i + 1}) ${grants[i].tool} — granted ${grants[i].grantedAt.slice(0, 10)} (${grants[i].grantedBy})`);
		}
	}
	if (pending.length > 0) {
		log(`\n  ${BOLD}Pending requests${RESET}\n`);
		for (const p of pending) {
			log(`  • ${p.tool} — requested ${p.requestedAt.slice(0, 10)}`);
		}
	}
}

export function registerExtensibilityHandlers(registry: HandlerRegistry): void {
	registry.registerAction("plugins:list", async (ctx) => {
		const { disk, paths, shell, input } = ctx.deps;
		const plugins = loadPlugins({ paths }, VAULT_ROOT, disk, shell);
		renderPluginList(toPluginListItems(plugins), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("plugins:validate", async (ctx) => {
		const { disk, paths, input } = ctx.deps;
		renderPluginValidation(toPluginValidationItems({ disk, paths }, VAULT_ROOT), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("plugins:create", async (ctx) => {
		const { disk, paths, input, log } = ctx.deps;
		const name = await input.ask("Plugin name (lowercase, hyphens)");
		if (!name) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const desc = await input.ask("Description");
		const result = scaffoldPlugin({ paths }, VAULT_ROOT, name, desc || "A Flowti plugin", disk);
		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Created plugin at ${DIM}${result.path}${RESET}`);
			log(`  ${DIM}Edit manifest.json to add commands.${RESET}\n`);
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("plugins:reference", async (ctx) => {
		const { disk, paths, clock, shell, input, log } = ctx.deps;
		const plugins = loadPlugins({ paths }, VAULT_ROOT, disk, shell);
		const doc = generatePluginReference({ clock }, plugins);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
		doc.save(outputPath, disk);
		log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("ai-tools:list", async (ctx) => {
		const { disk, paths, input } = ctx.deps;
		const tools = loadAiTools({ paths }, VAULT_ROOT, disk);
		renderToolList(toToolListItems(tools), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("ai-tools:validate", async (ctx) => {
		const { disk, paths, input } = ctx.deps;
		renderToolValidation(toToolValidationItems({ disk, paths }, VAULT_ROOT), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("ai-tools:create", async (ctx) => {
		const { disk, paths, input, log } = ctx.deps;
		const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
		if (!name) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const desc = await input.ask("Description");
		const run = await input.ask("Shell command to run");
		if (!run) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const result = scaffoldAiTool({ paths }, VAULT_ROOT, name, desc || "An AI tool", run, disk);
		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Created tool at ${DIM}${result.path}${RESET}`);
			log(`  ${DIM}Edit the JSON file to add parameters and tags.${RESET}\n`);
			maybeSyncTools(ctx);
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	registry.registerAction("ai-tools:reference", async (ctx) => {
		const { disk, paths, clock, input, log } = ctx.deps;
		const tools = loadAiTools({ paths }, VAULT_ROOT, disk);
		const doc = generateAiToolReference({ clock }, tools);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
		doc.save(outputPath, disk);
		log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
	const vaultAgents = cliConfig.agents;
	registry.registerDataSource("agents:list", (ctx: RouterContext): MenuEntry[] => {
		const agents = listAgents(ctx.deps, VAULT_ROOT, vaultAgents);
		return agents.map((a, i) => {
			const typeTag = `${DIM}[${a.agentType}]${RESET}`;
			const desc = a.description ? ` ${DIM}— ${a.description}${RESET}` : "";
			return {
				key: String(i + 1),
				label: `${a.name} ${typeTag}${desc}`,
				group: "agents",
				action: () => navigateWithParams("agent-detail", { agentName: a.name }) as MenuResult,
			};
		});
	});
	registry.registerAction("agents:add", async (ctx) => {
		const { addAgentInteractive } = await import("../menus/agents-menu.js");
		await addAgentInteractive(VAULT_ROOT, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});
	registry.registerAction("agents:remove", async (ctx) => {
		const { removeAgentInteractive } = await import("../menus/agents-menu.js");
		await removeAgentInteractive(VAULT_ROOT, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("agents:edit-identity", (ctx) => withAgent(ctx, async (agent) => {
		const { editAgentIdentity } = await import("../menus/agents-menu.js");
		await editAgentIdentity(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:edit-skills", (ctx) => withAgent(ctx, async (agent) => {
		const { editAgentSkills } = await import("../menus/agents-menu.js");
		await editAgentSkills(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:edit-tools", (ctx) => withAgent(ctx, async (agent) => {
		const { editAgentArrayField } = await import("../menus/agents-menu.js");
		await editAgentArrayField(VAULT_ROOT, agent, "tools", vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:edit-roles", (ctx) => withAgent(ctx, async (agent) => {
		const { editAgentArrayField } = await import("../menus/agents-menu.js");
		await editAgentArrayField(VAULT_ROOT, agent, "roles", vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:edit-ai", (ctx) => withAgent(ctx, async (agent) => {
		const { editAIConfigInteractive } = await import("../menus/agents-menu.js");
		await editAIConfigInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:edit-prompt", (ctx) => withAgent(ctx, async (agent) => {
		const { editSystemPromptInteractive } = await import("../menus/agents-menu.js");
		await editSystemPromptInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	}));
	registry.registerAction("agents:change-permission", (ctx) => withAgent(ctx, async (agent) => {
		if (agent.agentType !== "ai") { ctx.deps.log("\n  Only AI agents have permissions.\n"); return undefined; }
		const { readAgentState, writeAgentState } = await import("../../domain/agents/agent-state.js");
		const dir = varDir(ctx);
		const state = readAgentState(ctx.deps, dir, agent.name);
		const current = state.permissionOverride ?? agent.ai?.permissions?.mode ?? "ask";
		ctx.deps.log(`\n  Current mode: ${GREEN}${current}${RESET}\n`);
		ctx.deps.log(`  1) ask       — prompt for each tool call`);
		ctx.deps.log(`  2) auto-allow — safe tools run freely, others prompt`);
		ctx.deps.log(`  3) trust     — everything runs without prompting\n`);
		const choice = await ctx.deps.input.ask("Select mode (1/2/3)");
		const modes: Record<string, import("../../domain/agents/agent-types.js").PermissionMode> = { "1": "ask", "2": "auto-allow", "3": "trust" };
		const selected = modes[choice];
		if (!selected) { ctx.deps.log(`  ${DIM}Cancelled.${RESET}\n`); return undefined; }
		writeAgentState(ctx.deps, dir, agent.name, { ...state, permissionOverride: selected });
		ctx.deps.log(`  ${GREEN}✓${RESET} Permission mode set to ${selected}\n`);
		return undefined;
	}));
	registry.registerAction("agents:manage-grants", (ctx) => withAgent(ctx, async (agent) => {
		if (agent.agentType !== "ai") { ctx.deps.log("\n  Only AI agents have grants.\n"); return undefined; }
		const { readAgentState, writeAgentState } = await import("../../domain/agents/agent-state.js");
		const dir = varDir(ctx);
		const state = readAgentState(ctx.deps, dir, agent.name);
		const alwaysGrants = state.grants.filter((g) => g.scope === "always");
		if (alwaysGrants.length === 0 && state.pendingPermissions.length === 0) {
			ctx.deps.log(`\n  ${DIM}No grants or pending requests for ${agent.name}.${RESET}\n`);
			await ctx.deps.input.waitForEnter();
			return undefined;
		}
		renderGrantsList(alwaysGrants, state.pendingPermissions, ctx.deps.log);
		ctx.deps.log(`\n  r) Revoke a grant  c) Clear all  Enter) Back\n`);
		const choice = await ctx.deps.input.ask("Action");
		if (choice === "c") {
			writeAgentState(ctx.deps, dir, agent.name, { ...state, grants: [], pendingPermissions: [] });
			ctx.deps.log(`  ${GREEN}✓${RESET} All grants and pending requests cleared.\n`);
		} else if (choice === "r" && alwaysGrants.length > 0) {
			const idx = parseInt(await ctx.deps.input.ask("Grant number to revoke"), 10) - 1;
			if (idx >= 0 && idx < alwaysGrants.length) {
				const toolToRevoke = alwaysGrants[idx].tool;
				const filtered = state.grants.filter((g) => !(g.tool === toolToRevoke && g.scope === "always"));
				writeAgentState(ctx.deps, dir, agent.name, { ...state, grants: filtered });
				ctx.deps.log(`  ${GREEN}✓${RESET} Revoked ${toolToRevoke}\n`);
			}
		}
		await ctx.deps.input.waitForEnter();
		return undefined;
	}));
	registry.registerView("agent-detail", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return "main";
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) { ctx.deps.log(`\n  Agent "${agentName}" not found.\n`); return "main"; }
		const { renderAgentDetail, renderAgentState, renderPermissionInfo } = await import("../displays/agents-display.js");
		const { readAgentState } = await import("../../domain/agents/agent-state.js");
		const { runMenu } = await import("../../infrastructure/menu.js");
		const state = readAgentState(ctx.deps, varDir(ctx), agent.name);
		const worker = ctx.deps.workerManager.getWorker(agent.name);
		const onTaskAction = (a: import("../../domain/agents/agent-types.js").AgentSummary, t: string, c: RouterContext) => showTaskActions(a, t, c, VAULT_ROOT, vaultAgents);
		const taskItems = buildTaskMenuItems(state, agent, onTaskAction, ctx);
		return runMenu(null, [...taskItems, ...(ctx.dataSourceEntries?.["_actions"] ?? [])], {
			beforeMenu: () => {
				renderAgentDetail(agent, ctx.deps.log);
				renderAgentState(state, ctx.deps.log);
				renderPermissionInfo(agent, state, ctx.deps.log);
				if (worker && worker.state === "working") ctx.deps.log(`  ${GREEN}Currently working${RESET}`);
			},
		});
	});
	registry.registerView("agent-edit", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return "main";
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) { ctx.deps.log(`\n  Agent "${agentName}" not found.\n`); return "main"; }
		const { renderAgentDetail } = await import("../displays/agents-display.js");
		const { runMenu } = await import("../../infrastructure/menu.js");
		return runMenu(null, [...(ctx.dataSourceEntries?.["_actions"] ?? [])], {
			beforeMenu: () => renderAgentDetail(agent, ctx.deps.log),
		});
	});
	registry.registerAction("agents:talk", (ctx) => withAgent(ctx, async (agent) => {
		const { talkToAgentInteractive } = await import("../menus/agents-menu.js");
		await talkToAgentInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		await persistInteraction(agent, "talk", ctx);
		// Reset to idle after talk — unless agent has an active worker (working in background)
		const worker = ctx.deps.workerManager.getWorker(agent.name);
		if (!worker || worker.state !== "working") {
			const { readAgentState, writeAgentState } = await import("../../domain/agents/agent-state.js");
			const dir = varDir(ctx);
			const state = readAgentState(ctx.deps, dir, agent.name);
			if (state.status !== "idle") writeAgentState(ctx.deps, dir, agent.name, { ...state, status: "idle" });
		}
		await ctx.deps.input.waitForEnter();
		return undefined;
	}));
	registry.registerAction("agents:assign-task", (ctx) => withAgent(ctx, async (agent) => {
		const { assignTaskInteractive, clarifyTaskInteractive } = await import("../menus/agents-menu.js");
		const taskCtx = await buildTaskContext(ctx);
		const result = await assignTaskInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps, taskCtx);
		if (result) {
			await persistInteraction(agent, "task", ctx, result.taskName);
			if (agent.agentType === "ai") {
				await clarifyTaskInteractive(VAULT_ROOT, agent, vaultAgents, result.taskName, result.taskDescription, result.taskContext, ctx.deps);
			}
		}
		await runAgentAfterInteraction(agent, ctx);
		await ctx.deps.input.waitForEnter();
		return undefined;
	}));
	registry.registerAction("agents:assign-to-project", (ctx) => withAgent(ctx, async (agent) => {
		const { assignToProjectInteractive } = await import("../menus/agents-menu.js");
		await assignToProjectInteractive(VAULT_ROOT, agent, ctx.deps);
		return undefined;
	}));
	registry.registerAction("agents:edit-inventory", (ctx) => withAgent(ctx, async (agent) => {
		const { editInventoryInteractive } = await import("../menus/agents-menu.js");
		await editInventoryInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		return undefined;
	}));
	registry.registerAction("agents:navigate-edit", (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return Promise.resolve(undefined);
		return Promise.resolve(navigateWithParams("agent-edit", { agentName }) as MenuResult);
	});
	registry.registerAction("agent:status", async (ctx) => {
		if (!ctx.project) { ctx.deps.log("\n  No project selected.\n"); return undefined; }
		const iterCfg = ctx.project.config.management?.iterations;
		const iterDir = ctx.deps.paths.join(ctx.project.path, iterCfg?.dir ?? "iterations");
		const { listSessions } = await import("../../domain/agents/agent-session.js");
		const { renderSessionList } = await import("../displays/agent-run-display.js");
		const sessions = listSessions(ctx.deps, iterDir);
		renderSessionList(sessions, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});
}
