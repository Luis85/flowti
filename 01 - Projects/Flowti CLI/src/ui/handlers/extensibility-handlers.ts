/**
 * extensibility-handlers.ts — Action handlers for plugins and AI tools menus.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { VAULT_ROOT, CLI_PROJECT, cliConfig } from "../../infrastructure/config.js";
import { navigateWithParams } from "../../infrastructure/sitemap-router.js";
import { listAgents } from "../../domain/agents/agent-store.js";
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

async function runAgentAfterInteraction(agent: import("../../domain/agents/agent-types.js").AgentSummary, ctx: RouterContext): Promise<void> {
	if (!ctx.project) return;
	const iterCfg = ctx.project.config.management?.iterations;
	try {
		const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
		const iteration = findCurrentIteration(ctx.deps, ctx.project.path, iterCfg);
		if (!iteration) return;
		const iterDir = ctx.deps.paths.join(ctx.project.path, iterCfg?.dir ?? "iterations");
		const autonomous = cliConfig.agents?.autonomous === true;
		const vDir = varDir(ctx);
		const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
		const stateFilePath = ctx.deps.paths.join(vDir, `data-${slug}.json`);
		const { runAgentInteractive } = await import("../menus/agents-run-menu.js");
		await runAgentInteractive(agent, iteration, iterDir, autonomous, ctx.deps, stateFilePath, cliConfig.agents?.skillMap?.[agent.domain ?? ""]);
		// Record the brief in state
		const { readAgentState, writeAgentState, addBrief } = await import("../../domain/agents/agent-state.js");
		const state = readAgentState(ctx.deps, vDir, agent.name);
		const briefPath = ctx.deps.paths.join(iterDir, "briefs");
		writeAgentState(ctx.deps, vDir, agent.name, addBrief(state, { path: briefPath, generatedAt: ctx.deps.clock.iso(), autonomous }));
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

export function registerExtensibilityHandlers(registry: HandlerRegistry): void {
	// ── Plugin handlers ─────────────────────────────────────────────

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

	// ── AI Tools handlers ───────────────────────────────────────────

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

	// ── Agent handlers (vault-level) ────────────────────────────────
	// Agents are vault-level entities, not project-scoped.
	// All agent operations use VAULT_ROOT + cliConfig.agents.

	const vaultAgents = cliConfig.agents;

	// Data source: list all vault agents as selectable entries
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

	registry.registerAction("agents:edit-identity", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editAgentIdentity } = await import("../menus/agents-menu.js");
		await editAgentIdentity(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	registry.registerAction("agents:edit-skills", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editAgentSkills } = await import("../menus/agents-menu.js");
		await editAgentSkills(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	registry.registerAction("agents:edit-tools", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editAgentArrayField } = await import("../menus/agents-menu.js");
		await editAgentArrayField(VAULT_ROOT, agent, "tools", vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	registry.registerAction("agents:edit-roles", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editAgentArrayField } = await import("../menus/agents-menu.js");
		await editAgentArrayField(VAULT_ROOT, agent, "roles", vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	registry.registerAction("agents:edit-ai", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editAIConfigInteractive } = await import("../menus/agents-menu.js");
		await editAIConfigInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	registry.registerAction("agents:edit-prompt", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editSystemPromptInteractive } = await import("../menus/agents-menu.js");
		await editSystemPromptInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		maybeSyncAgents(ctx);
		return undefined;
	});

	// ── Agent detail view ────────────────────────────────────────────

	registry.registerView("agent-detail", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return "main";
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const { renderAgentDetail, renderAgentState } = await import("../displays/agents-display.js");
		const { readAgentState } = await import("../../domain/agents/agent-state.js");
		const { runMenu } = await import("../../infrastructure/menu.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) {
			ctx.deps.log(`\n  Agent "${agentName}" not found.\n`);
			return "main";
		}
		const state = readAgentState(ctx.deps, varDir(ctx), agent.name);
		const handle = ctx.deps.agentShell.getActiveDispatch(agent.name);
		const actions = [...(ctx.dataSourceEntries?.["_actions"] ?? [])];
		return runMenu(null, actions, {
			beforeMenu: () => {
				renderAgentDetail(agent, ctx.deps.log);
				renderAgentState(state, ctx.deps.log);
				if (handle) {
					ctx.deps.log(`  ${GREEN}Currently working on:${RESET} ${handle.task}`);
				}
			},
		});
	});

	// ── Agent edit view ─────────────────────────────────────────────

	registry.registerView("agent-edit", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return "main";
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const { renderAgentDetail } = await import("../displays/agents-display.js");
		const { runMenu } = await import("../../infrastructure/menu.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) {
			ctx.deps.log(`\n  Agent "${agentName}" not found.\n`);
			return "main";
		}
		const actions = [...(ctx.dataSourceEntries?.["_actions"] ?? [])];
		return runMenu(null, actions, {
			beforeMenu: () => renderAgentDetail(agent, ctx.deps.log),
		});
	});

	// ── Agent interaction handlers ──────────────────────────────────

	registry.registerAction("agents:talk", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { talkToAgentInteractive } = await import("../menus/agents-menu.js");
		await talkToAgentInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		await persistInteraction(agent, "talk", ctx);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("agents:assign-task", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
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
	});

	registry.registerAction("agents:assign-to-project", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { assignToProjectInteractive } = await import("../menus/agents-menu.js");
		await assignToProjectInteractive(VAULT_ROOT, agent, ctx.deps);
		return undefined;
	});

	registry.registerAction("agents:edit-inventory", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, vaultAgents);
		if (!agent) return undefined;
		const { editInventoryInteractive } = await import("../menus/agents-menu.js");
		await editInventoryInteractive(VAULT_ROOT, agent, vaultAgents, ctx.deps);
		return undefined;
	});

	registry.registerAction("agents:navigate-edit", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return undefined;
		return navigateWithParams("agent-edit", { agentName }) as MenuResult;
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
