/**
 * crud-handlers.ts — Action handlers for CRUD management menus.
 *
 * Registers action handlers for RAID, CAPA, deliverables, resources,
 * and timelog — replacing the former dynamic view handlers with
 * sitemap-driven static views.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";

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
		const created = await addIterationInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
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

	registry.registerAction("iteration:attach-agent", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { attachAgentInteractive } = await import("../menus/iterations-menu.js");
		await attachAgentInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:add-resource", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addResourceInteractive } = await import("../menus/iterations-menu.js");
		await addResourceInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:add-capacity", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addCapacityInteractive } = await import("../menus/iterations-menu.js");
		await addCapacityInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:add-scope", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addScopeItemInteractive } = await import("../menus/iterations-menu.js");
		await addScopeItemInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:add-note", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { addNoteInteractive } = await import("../menus/iterations-menu.js");
		await addNoteInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:edit-scope", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { editScopeInteractive } = await import("../menus/iterations-menu.js");
		await editScopeInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:remove-scope", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { removeScopeInteractive } = await import("../menus/iterations-menu.js");
		await removeScopeInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:toggle-scope", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { toggleScopeInteractive } = await import("../menus/iterations-menu.js");
		await toggleScopeInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:edit-description", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { editDescriptionInteractive } = await import("../menus/iterations-menu.js");
		await editDescriptionInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:edit-name", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { editNameInteractive } = await import("../menus/iterations-menu.js");
		await editNameInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:edit-goal", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { editGoalInteractive } = await import("../menus/iterations-menu.js");
		await editGoalInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});

	registry.registerAction("iteration:edit-dates", async (ctx) => {
		if (!ctx.project) return undefined;
		const { input } = ctx.deps;
		const { editDatesInteractive } = await import("../menus/iterations-menu.js");
		await editDatesInteractive(ctx.project.path, ctx.project.config.management?.iterations, ctx.deps);
		await input.waitForEnter();
		return "navigate:iteration-detail" as MenuResult;
	});
}
