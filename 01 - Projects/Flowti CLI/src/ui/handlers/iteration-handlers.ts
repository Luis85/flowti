/**
 * iteration-handlers.ts — Action handlers for iteration management.
 *
 * Extracted from crud-handlers.ts to keep files under the line limit.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";

/** Resolve system prompt for a named agent (vault-level). */
async function resolveAgentPrompt(ctx: RouterContext, agentName: string): Promise<string | null> {
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { findAgent, readSystemPrompt } = await import("../../domain/agents/agent-store.js");
	const agentDef = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	return agentDef ? readSystemPrompt(ctx.deps, VAULT_ROOT, agentDef.name, cliConfig.agents) : null;
}

/** Generate a brief for the active agent on the current iteration. Returns file path or null. */
async function generateIterationBrief(ctx: RouterContext): Promise<string | null> {
	if (!ctx.project) return null;
	const { findCurrentIteration, iterationsDir } = await import("../../domain/iterations/iteration-store.js");
	const { getActiveAgent } = await import("../../domain/agents/agent-orchestration.js");
	const { generateBrief, briefFileName } = await import("../../domain/agents/agent-brief.js");
	const { loadIterationTemplate } = await import("./iteration-template-loader.js");
	const { getValidTransitions } = await import("../../domain/lifecycle/lifecycle-engine.js");
	const config = ctx.project.config.management?.iterations;
	const iteration = findCurrentIteration(ctx.deps, ctx.project.path, config);
	if (!iteration) { ctx.deps.log("\n  No active iteration.\n"); return null; }
	const active = getActiveAgent(config?.orchestration, iteration.status);
	if (!active) { ctx.deps.log("\n  No agent bound to the current phase.\n"); return null; }
	const systemPrompt = await resolveAgentPrompt(ctx, active.name);
	const template = loadIterationTemplate(ctx.deps, ctx.project.path, config);
	const validTransitions = template ? getValidTransitions(template, iteration.status) : [];
	const brief = generateBrief({ agent: active, iteration, systemPrompt, validTransitions });
	const dir = iterationsDir(ctx.deps, ctx.project.path, config);
	const briefsDir = ctx.deps.paths.join(dir, "briefs");
	if (!ctx.deps.disk.existsSync(briefsDir)) ctx.deps.disk.mkdirSync(briefsDir, { recursive: true });
	const outPath = ctx.deps.paths.join(briefsDir, briefFileName(iteration.number, iteration.status));
	ctx.deps.disk.writeFileSync(outPath, brief, "utf-8");
	return outPath;
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

	return writeFullBrief(ctx, agent.name, iteration, config);
}

async function writeFullBrief(
	ctx: RouterContext, agentName: string, iteration: import("../../domain/iterations/iteration-types.js").IterationSummary,
	config: import("../../infrastructure/types.js").IterationsConfig | undefined,
): Promise<string | null> {
	const { generateFullIterationBrief, briefFileName } = await import("../../domain/agents/agent-brief.js");
	const { loadIterationTemplate } = await import("./iteration-template-loader.js");
	const { iterationsDir } = await import("../../domain/iterations/iteration-store.js");
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { readSystemPrompt } = await import("../../domain/agents/agent-store.js");

	const template = loadIterationTemplate(ctx.deps, ctx.project!.path, config);
	if (!template) { ctx.deps.log("\n  No lifecycle template found.\n"); return null; }

	const systemPrompt = readSystemPrompt(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
	const brief = generateFullIterationBrief({ agentName, iteration, systemPrompt, template, orchestration: config?.orchestration });

	const briefsDir = ctx.deps.paths.join(iterationsDir(ctx.deps, ctx.project!.path, config), "briefs");
	if (!ctx.deps.disk.existsSync(briefsDir)) ctx.deps.disk.mkdirSync(briefsDir, { recursive: true });
	const outPath = ctx.deps.paths.join(briefsDir, briefFileName(iteration.number, "full"));
	ctx.deps.disk.writeFileSync(outPath, brief, "utf-8");
	return outPath;
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

	// iteration:add-agent is separate — agents are vault-level, need VAULT_ROOT
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
		["iteration:add-scope", "addScopeItemInteractive"],
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
}
