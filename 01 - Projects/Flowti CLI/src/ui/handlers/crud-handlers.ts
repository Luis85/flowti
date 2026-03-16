/**
 * crud-handlers.ts — Action handlers for CRUD management menus.
 *
 * Registers action handlers for RAID, CAPA, deliverables, resources,
 * and timelog — replacing the former dynamic view handlers with
 * sitemap-driven static views.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { registerIterationHandlers } from "./iteration-handlers.js";

export function registerCrudHandlers(registry: HandlerRegistry): void {
	registerIterationHandlers(registry);
	// ── RAID handlers ───────────────────────────────────────────────

	registry.registerAction("raid:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { raidStore } = await import("../../domain/raid/raid-store.js");
		const { renderRAIDList } = await import("../displays/raid-display.js");
		renderRAIDList(raidStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.raid ? { dir: ctx.project.config.management.raid.dir } : undefined), ctx.deps.log);
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
		const { capaStore } = await import("../../domain/capa/capa-store.js");
		const { renderCAPAList } = await import("../displays/capa-display.js");
		renderCAPAList(capaStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.capa ? { dir: ctx.project.config.management.capa.dir } : undefined), ctx.deps.log);
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
		const { deliverableStore } = await import("../../domain/deliverables/deliverable-store.js");
		const { renderDeliverableList } = await import("../displays/deliverables-display.js");
		renderDeliverableList(deliverableStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.deliverables ? { dir: ctx.project.config.management.deliverables.dir } : undefined), ctx.deps.log);
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
		const { resourceStore } = await import("../../domain/resources/resource-store.js");
		const { renderResourceList } = await import("../displays/resources-display.js");
		renderResourceList(resourceStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.resources ? { dir: ctx.project.config.management.resources.dir } : undefined), ctx.deps.log);
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
		const { resourceStore } = await import("../../domain/resources/resource-store.js");
		const { analyzeFinancials } = await import("../../domain/resources/resource-analysis.js");
		const { renderFinancialSummary } = await import("../displays/resources-display.js");
		renderFinancialSummary(analyzeFinancials(resourceStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.resources ? { dir: ctx.project.config.management.resources.dir } : undefined)), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Timelog handlers ────────────────────────────────────────────

	registry.registerAction("timelog:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { disk, paths, input } = ctx.deps;
		const { timelogStore } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogList } = await import("../displays/timelog-display.js");
		renderTimeLogList(timelogStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.timelog ? { dir: ctx.project.config.management.timelog.dir } : undefined), ctx.deps.log);
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
		const { timelogStore, summarizeTimeLog } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogSummary } = await import("../displays/timelog-display.js");
		const entries = timelogStore.list({ disk, paths }, ctx.project.path, ctx.project.config.management?.timelog ? { dir: ctx.project.config.management.timelog.dir } : undefined);
		renderTimeLogSummary(summarizeTimeLog(entries), ctx.deps.log);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

}
