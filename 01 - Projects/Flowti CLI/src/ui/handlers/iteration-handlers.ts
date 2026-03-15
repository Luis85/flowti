/**
 * iteration-handlers.ts — Action handlers for iteration management.
 *
 * Extracted from crud-handlers.ts to keep files under the line limit.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";

/** Build roster entries for prompt variable resolution. */
function toRosterEntries(agents: Array<{ name: string; description: string; roles: string[]; skills: Array<{ name: string }> }>): Array<{ name: string; description: string; roles: string[]; skills: string[] }> {
	return agents.map((a) => ({ name: a.name, description: a.description, roles: a.roles, skills: a.skills.map((s) => s.name) }));
}

/** Resolve system prompt for a named agent (vault-level), with roster variables resolved. */
async function resolveAgentPrompt(ctx: RouterContext, agentName: string): Promise<string | null> {
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { findAgent, readSystemPrompt, getProjectAgents } = await import("../../domain/agents/agent-store.js");
	const agentDef = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	if (!agentDef) return null;
	let prompt = readSystemPrompt(ctx.deps, VAULT_ROOT, agentDef.name, cliConfig.agents);
	if (prompt) {
		const { resolvePromptVariables } = await import("../../domain/agents/brief-store.js");
		const roster = getProjectAgents(ctx.deps, VAULT_ROOT, cliConfig.agents, ctx.project?.config.management?.agents?.roster);
		prompt = resolvePromptVariables(prompt, toRosterEntries(roster));
	}
	return prompt;
}

/** Resolve agent details (description, skills, roles) for brief context. */
async function resolveAgentDetails(ctx: RouterContext, agentName: string): Promise<{ description: string; skills: string[]; roles: string[] } | null> {
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { findAgent } = await import("../../domain/agents/agent-store.js");
	const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	if (!agent) return null;
	return { description: agent.description, skills: agent.skills.map((s) => s.name), roles: agent.roles };
}

/** Resolve available skills for an agent based on domain → skillMap lookup. */
async function resolveAvailableSkills(ctx: RouterContext, agentName: string): Promise<readonly string[] | undefined> {
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { findAgent } = await import("../../domain/agents/agent-store.js");
	const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	return cliConfig.agents?.skillMap?.[agent?.domain ?? ""];
}

/** Build scope recommendations from roster agents' suggested tasks. */
async function buildScopeRecommendations(ctx: RouterContext): Promise<Array<{ agentName: string; tasks: Array<{ name: string; phases: string[] }> }>> {
	if (!ctx.project) return [];
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { getProjectAgents } = await import("../../domain/agents/agent-store.js");
	const roster = ctx.project.config.management?.agents?.roster;
	const agents = getProjectAgents(ctx.deps, VAULT_ROOT, cliConfig.agents, roster);
	const recs: Array<{ agentName: string; tasks: Array<{ name: string; phases: string[] }> }> = [];
	for (const agent of agents) {
		if (agent.suggestedTasks && agent.suggestedTasks.length > 0) {
			recs.push({ agentName: agent.name, tasks: agent.suggestedTasks });
		}
	}
	return recs;
}

/** Generate a brief for the active agent on the current iteration. */
async function generateIterationBrief(ctx: RouterContext): Promise<string | null> {
	if (!ctx.project) return null;
	const { findCurrentIteration, iterationsDir } = await import("../../domain/iterations/iteration-store.js");
	const { getActiveAgent } = await import("../../domain/agents/agent-orchestration.js");
	const { generateBrief, saveBrief } = await import("../../domain/agents/brief-store.js");
	const { loadIterationTemplate } = await import("./iteration-template-loader.js");
	const config = ctx.project.config.management?.iterations;
	const iteration = findCurrentIteration(ctx.deps, ctx.project.path, config);
	if (!iteration) { ctx.deps.log("\n  No active iteration.\n"); return null; }
	const active = getActiveAgent(config?.orchestration, iteration.status);
	if (!active) { ctx.deps.log("\n  No agent bound to the current phase.\n"); return null; }
	const systemPrompt = await resolveAgentPrompt(ctx, active.name);
	const details = await resolveAgentDetails(ctx, active.name);
	const template = loadIterationTemplate(ctx.deps, ctx.project.path, config);
	const availableSkills = await resolveAvailableSkills(ctx, active.name);
	const brief = generateBrief({
		agentName: active.name, agentDescription: details?.description, agentSkills: details?.skills, agentRoles: details?.roles,
		systemPrompt, iteration, iterationTemplate: template ?? undefined, availableSkills,
	});
	const dir = iterationsDir(ctx.deps, ctx.project.path, config);
	return saveBrief(ctx.deps, dir, iteration.number, active.name, iteration.status, brief);
}

/** Prompt the user to select an agent, then generate and write a full-iteration brief. */
async function executeFullIteration(ctx: RouterContext): Promise<string | null> {
	if (!ctx.project) return null;
	const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { getProjectAgents } = await import("../../domain/agents/agent-store.js");
	const { renderAgentList } = await import("../displays/agents-display.js");

	const config = ctx.project.config.management?.iterations;
	const iteration = findCurrentIteration(ctx.deps, ctx.project.path, config);
	if (!iteration) { ctx.deps.log("\n  No active iteration.\n"); return null; }

	const agents = getProjectAgents(ctx.deps, VAULT_ROOT, cliConfig.agents, ctx.project.config.management?.agents?.roster);
	if (agents.length === 0) { ctx.deps.log("\n  No agents available.\n"); return null; }

	renderAgentList(agents, ctx.deps.log);
	const choice = await ctx.deps.input.ask("Select agent for full execution");
	if (!choice) return null;

	const agent = resolveByChoice(choice, agents);
	if (!agent) { ctx.deps.log(`\n  Agent "${choice}" not found.\n`); return null; }

	return writeFullBrief(ctx, agent, iteration, config);
}

async function writeFullBrief(
	ctx: RouterContext, agent: { name: string; description: string; roles: string[]; skills: Array<{ name: string }> },
	iteration: import("../../domain/iterations/iteration-types.js").IterationSummary,
	config: import("../../infrastructure/types.js").IterationsConfig | undefined,
): Promise<string | null> {
	const { generateBrief, saveBrief } = await import("../../domain/agents/brief-store.js");
	const { loadIterationTemplate } = await import("./iteration-template-loader.js");
	const { iterationsDir } = await import("../../domain/iterations/iteration-store.js");

	const template = loadIterationTemplate(ctx.deps, ctx.project!.path, config);
	if (!template) { ctx.deps.log("\n  No lifecycle template found.\n"); return null; }

	const systemPrompt = await resolveAgentPrompt(ctx, agent.name);
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { getProjectAgents } = await import("../../domain/agents/agent-store.js");
	const rosterAgents = toRosterEntries(getProjectAgents(ctx.deps, VAULT_ROOT, cliConfig.agents, ctx.project!.config.management?.agents?.roster));
	const availableSkills = await resolveAvailableSkills(ctx, agent.name);
	const brief = generateBrief({
		agentName: agent.name, agentDescription: agent.description,
		agentSkills: agent.skills.map((s) => s.name), agentRoles: agent.roles,
		systemPrompt, iteration, iterationTemplate: template, orchestration: config?.orchestration, rosterAgents, availableSkills,
	});
	const dir = iterationsDir(ctx.deps, ctx.project!.path, config);
	return saveBrief(ctx.deps, dir, iteration.number, agent.name, iteration.status, brief);
}

function resolveByChoice<T extends { name: string }>(choice: string, items: T[]): T | undefined {
	const idx = parseInt(choice, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= items.length) return items[idx - 1];
	return items.find((a) => a.name.toLowerCase() === choice.toLowerCase());
}

export function registerIterationHandlers(registry: HandlerRegistry): void {
	registry.registerAction("iteration:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listIterations } = await import("../../domain/iterations/iteration-store.js");
		const { renderIterationList } = await import("../displays/iterations-display.js");
		renderIterationList(listIterations({ disk, paths }, ctx.project.path, ctx.project.config.management?.iterations), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("iteration:create", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addIterationInteractive } = await import("../menus/iterations-menu.js");
		const { loadIterationTemplate } = await import("./iteration-template-loader.js");
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations) ?? undefined;
		const created = await addIterationInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps, template);
		if (created) {
			await input.waitForEnter();
			return "navigate:iteration-detail" as MenuResult;
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("iteration:advance", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { advanceIterationInteractive } = await import("../menus/iterations-menu.js");
		const { loadIterationTemplate } = await import("./iteration-template-loader.js");
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations);
		if (!template) { ctx.deps.log("\n  Could not load iteration lifecycle definition.\n"); await input.waitForEnter(); return "navigate:iteration-detail" as MenuResult; }
		await advanceIterationInteractive(ctx.project.path, ctx.project.config.management?.iterations, template, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:current", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { showCurrentIteration } = await import("../menus/iterations-menu.js");
		await showCurrentIteration(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:plan-ahead", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { planAheadInteractive } = await import("../menus/iterations-menu.js");
		const { loadIterationTemplate } = await import("./iteration-template-loader.js");
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations) ?? undefined;
		await planAheadInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps, template);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("iteration:browse", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { browseIterationsInteractive } = await import("../menus/iterations-menu.js");
		const { navigateWithParams } = await import("../../infrastructure/sitemap-router.js");
		const num = await browseIterationsInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		if (num !== null) {
			return navigateWithParams("iteration-detail", { iterationNumber: num }) as MenuResult;
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("iteration:generate-brief", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input, log } = ctx.deps;
		const result = await generateIterationBrief(ctx);
		if (result) {
			const { renderBriefGenerated } = await import("../displays/iterations-display.js");
			renderBriefGenerated(result, log);
		}
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:execute-full", async (ctx) => {
		if (!ctx.project) return undefined;
		const result = await executeFullIteration(ctx);
		if (result) {
			const { renderBriefGenerated } = await import("../displays/iterations-display.js");
			renderBriefGenerated(result, ctx.deps.log);
		}
		await ctx.deps.input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:add-agent", async (ctx) => {
		if (!ctx.project) return undefined;
		const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
		const { addAgentInteractive } = await import("../menus/iterations-menu.js");
		await addAgentInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps, {
			agentsBasePath: VAULT_ROOT, agentsConfig: cliConfig.agents,
			roster: ctx.project.config.management?.agents?.roster,
		});
		await ctx.deps.input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	const iterMenuActions: [string, string][] = [
		["iteration:add-resource", "addResourceInteractive"],
		["iteration:add-estimation", "addEstimationInteractive"],
		["iteration:add-note", "addNoteInteractive"],
		["iteration:edit-scope", "editScopeInteractive"],
		["iteration:remove-scope", "removeScopeInteractive"],
		["iteration:toggle-scope", "toggleScopeInteractive"],
		["iteration:edit-description", "editDescriptionInteractive"],
		["iteration:edit-name", "editNameInteractive"],
		["iteration:edit-goal", "editGoalInteractive"],
		["iteration:edit-dates", "editDatesInteractive"],
	];
	for (const [id, fnName] of iterMenuActions) {
		registry.registerAction(id, async (ctx) => {
			if (!ctx.project) return undefined;
			const mod = await import("../menus/iterations-menu.js");
			const fn = (mod as unknown as Record<string, (...args: unknown[]) => Promise<void>>)[fnName];
			await fn(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
			await ctx.deps.input.waitForEnter();
			return "navigate:iteration-detail" as MenuResult;
		});
	}

	registry.registerAction("iteration:add-scope", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addScopeItemInteractive } = await import("../menus/iterations-scope-menu.js");
		const recommendations = await buildScopeRecommendations(ctx);
		await addScopeItemInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps, { recommendations });
		await ctx.deps.input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:roster-task", async (ctx) => {
		if (!ctx.project) return undefined;
		const { rosterTaskInteractive } = await import("../menus/roster-task-menu.js");
		const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
		const { loadIterationTemplate } = await import("./iteration-template-loader.js");
		const template = loadIterationTemplate(ctx.deps, ctx.project.path, ctx.project.config.management?.iterations) ?? undefined;
		await rosterTaskInteractive({
			projectPath: ctx.project.path, iterationsConfig: ctx.project.config.management?.iterations,
			roster: ctx.project.config.management?.agents?.roster,
			vaultRoot: VAULT_ROOT, agentsConfig: cliConfig.agents, template,
		}, ctx.deps);
		await ctx.deps.input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});
}
