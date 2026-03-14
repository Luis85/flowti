/**
 * crud-handlers.ts — Action handlers for CRUD management menus.
 *
 * Registers action handlers for RAID, CAPA, deliverables, resources,
 * and timelog — replacing the former dynamic view handlers with
 * sitemap-driven static views.
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

export function registerCrudHandlers(registry: HandlerRegistry): void {
	// ── RAID handlers ───────────────────────────────────────────────

	registry.registerAction("raid:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listRAIDItems } = await import("../../domain/raid/raid-store.js");
		const { renderRAIDList } = await import("../displays/raid-display.js");
		renderRAIDList(listRAIDItems({ disk, paths }, ctx.project.path, ctx.project.config.management?.raid), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-risk", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("risk", ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-assumption", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("assumption", ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-issue", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("issue", ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-dependency", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("dependency", ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-decision", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("decision", ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const m = await import("../menus/raid-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.raid, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── CAPA handlers ───────────────────────────────────────────────

	registry.registerAction("capa:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listCAPAItems } = await import("../../domain/capa/capa-store.js");
		const { renderCAPAList } = await import("../displays/capa-display.js");
		renderCAPAList(listCAPAItems({ disk, paths }, ctx.project.path, ctx.project.config.management?.capa), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:add-corrective", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addCAPAInteractive } = await import("../menus/capa-menu.js");
		await addCAPAInteractive("corrective", ctx.project.path, ctx.project.config.management?.capa, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:add-preventive", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addCAPAInteractive } = await import("../menus/capa-menu.js");
		await addCAPAInteractive("preventive", ctx.project.path, ctx.project.config.management?.capa, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const m = await import("../menus/capa-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.capa, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Deliverables handlers ───────────────────────────────────────

	registry.registerAction("deliverables:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listDeliverables } = await import("../../domain/deliverables/deliverable-store.js");
		const { renderDeliverableList } = await import("../displays/deliverables-display.js");
		renderDeliverableList(listDeliverables({ disk, paths }, ctx.project.path, ctx.project.config.management?.deliverables), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("deliverables:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addDeliverableInteractive } = await import("../menus/deliverables-menu.js");
		await addDeliverableInteractive(ctx.project.path, ctx.project.config.management?.deliverables, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("deliverables:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const m = await import("../menus/deliverables-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.deliverables, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Resources handlers ──────────────────────────────────────────

	registry.registerAction("resources:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listResources } = await import("../../domain/resources/resource-store.js");
		const { renderResourceList } = await import("../displays/resources-display.js");
		renderResourceList(listResources({ disk, paths }, ctx.project.path, ctx.project.config.management?.resources), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-human", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "human", ctx.project.config.management?.resources, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-material", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "material", ctx.project.config.management?.resources, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-role", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "role", ctx.project.config.management?.resources, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-budget", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "budget", ctx.project.config.management?.resources, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:financials", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listResources } = await import("../../domain/resources/resource-store.js");
		const { analyzeFinancials } = await import("../../domain/resources/resource-analysis.js");
		const { renderFinancialSummary } = await import("../displays/resources-display.js");
		renderFinancialSummary(analyzeFinancials(listResources({ disk, paths }, ctx.project.path, ctx.project.config.management?.resources)), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Timelog handlers ────────────────────────────────────────────

	registry.registerAction("timelog:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listTimeLogEntries } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogList } = await import("../displays/timelog-display.js");
		renderTimeLogList(listTimeLogEntries({ disk, paths }, ctx.project.path, ctx.project.config.management?.timelog), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("timelog:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { logTimeInteractive } = await import("../menus/timelog-menu.js");
		await logTimeInteractive(ctx.project.path, ctx.project.config.management?.timelog, ctx.deps);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("timelog:summary", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { listTimeLogEntries, summarizeTimeLog } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogSummary } = await import("../displays/timelog-display.js");
		const entries = listTimeLogEntries({ disk, paths }, ctx.project.path, ctx.project.config.management?.timelog);
		renderTimeLogSummary(summarizeTimeLog(entries), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Iteration handlers ─────────────────────────────────────────

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
