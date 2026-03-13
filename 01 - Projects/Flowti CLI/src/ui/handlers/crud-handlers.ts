/**
 * crud-handlers.ts — Action handlers for CRUD management menus.
 *
 * Registers action handlers for RAID, CAPA, deliverables, resources,
 * and timelog — replacing the former dynamic view handlers with
 * sitemap-driven static views.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";

function storeDeps() { return { disk, paths, clock } as const; }

export function registerCrudHandlers(registry: HandlerRegistry): void {
	// ── RAID handlers ───────────────────────────────────────────────

	registry.registerAction("raid:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listRAIDItems } = await import("../../domain/raid/raid-store.js");
		const { renderRAIDList } = await import("../raid-display.js");
		renderRAIDList(listRAIDItems(storeDeps(), ctx.project.path, ctx.project.config.management?.raid));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-risk", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("risk", ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-assumption", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("assumption", ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-issue", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("issue", ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-dependency", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("dependency", ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:add-decision", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRAIDInteractive } = await import("../menus/raid-menu.js");
		await addRAIDInteractive("decision", ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("raid:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const m = await import("../menus/raid-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.raid);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── CAPA handlers ───────────────────────────────────────────────

	registry.registerAction("capa:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listCAPAItems } = await import("../../domain/capa/capa-store.js");
		const { renderCAPAList } = await import("../capa-display.js");
		renderCAPAList(listCAPAItems(storeDeps(), ctx.project.path, ctx.project.config.management?.capa));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:add-corrective", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addCAPAInteractive } = await import("../menus/capa-menu.js");
		await addCAPAInteractive("corrective", ctx.project.path, ctx.project.config.management?.capa);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:add-preventive", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addCAPAInteractive } = await import("../menus/capa-menu.js");
		await addCAPAInteractive("preventive", ctx.project.path, ctx.project.config.management?.capa);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("capa:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const m = await import("../menus/capa-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.capa);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Deliverables handlers ───────────────────────────────────────

	registry.registerAction("deliverables:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listDeliverables } = await import("../../domain/deliverables/deliverable-store.js");
		const { renderDeliverableList } = await import("../deliverables-display.js");
		renderDeliverableList(listDeliverables(storeDeps(), ctx.project.path, ctx.project.config.management?.deliverables));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("deliverables:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addDeliverableInteractive } = await import("../menus/deliverables-menu.js");
		await addDeliverableInteractive(ctx.project.path, ctx.project.config.management?.deliverables);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("deliverables:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const m = await import("../menus/deliverables-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.deliverables);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Resources handlers ──────────────────────────────────────────

	registry.registerAction("resources:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listResources } = await import("../../domain/resources/resource-store.js");
		const { renderResourceList } = await import("../resources-display.js");
		renderResourceList(listResources(storeDeps(), ctx.project.path, ctx.project.config.management?.resources));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-human", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "human", ctx.project.config.management?.resources);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-material", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "material", ctx.project.config.management?.resources);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-role", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "role", ctx.project.config.management?.resources);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:add-budget", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addResourceInteractive } = await import("../menus/resources-menu.js");
		await addResourceInteractive(ctx.project.path, "budget", ctx.project.config.management?.resources);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("resources:financials", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listResources } = await import("../../domain/resources/resource-store.js");
		const { analyzeFinancials } = await import("../../domain/resources/resource-analysis.js");
		const { renderFinancialSummary } = await import("../resources-display.js");
		renderFinancialSummary(analyzeFinancials(listResources(storeDeps(), ctx.project.path, ctx.project.config.management?.resources)));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Timelog handlers ────────────────────────────────────────────

	registry.registerAction("timelog:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listTimeLogEntries } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogList } = await import("../timelog-display.js");
		renderTimeLogList(listTimeLogEntries(storeDeps(), ctx.project.path, ctx.project.config.management?.timelog));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("timelog:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { logTimeInteractive } = await import("../menus/timelog-menu.js");
		await logTimeInteractive(ctx.project.path, ctx.project.config.management?.timelog);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("timelog:summary", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listTimeLogEntries, summarizeTimeLog } = await import("../../domain/timelog/timelog-store.js");
		const { renderTimeLogSummary } = await import("../timelog-display.js");
		const entries = listTimeLogEntries(storeDeps(), ctx.project.path, ctx.project.config.management?.timelog);
		renderTimeLogSummary(summarizeTimeLog(entries));
		await input.waitForEnter();
		return "main" as MenuResult;
	});
}
