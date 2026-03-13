/**
 * development-handlers.ts — Action handlers for event catalog and lifecycle menus.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, GREEN } from "../../infrastructure/ui.js";

function eventDeps() { return { disk, paths, clock } as const; }

export function registerDevelopmentHandlers(registry: HandlerRegistry): void {
	// ── Event Catalog handlers ──────────────────────────────────────

	registry.registerAction("events:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listEventsInteractive } = await import("../menus/event-catalog-menu.js");
		listEventsInteractive(ctx.project.path);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("events:add", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addEventInteractive } = await import("../menus/event-catalog-menu.js");
		await addEventInteractive(ctx.project.path);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("events:flow", async (ctx) => {
		if (!ctx.project) return undefined;
		const { saveEventFlowDoc } = await import("../../domain/events/event-flow.js");
		const filePath = saveEventFlowDoc(eventDeps(), ctx.project.path);
		const relPath = paths.relative(ctx.project.path, filePath);
		log(`\n  ${GREEN}✓${RESET} Generated: ${relPath}\n`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── Lifecycle handlers ──────────────────────────────────────────

	registry.registerAction("lifecycle:project", async (ctx) => {
		if (!ctx.project) return undefined;
		const { lifecycleStatusMenu } = await import("../menus/lifecycle-menu.js");
		return lifecycleStatusMenu(ctx.project.path, ctx.project.config.name, "project");
	});

	registry.registerAction("lifecycle:features", async (ctx) => {
		if (!ctx.project) return undefined;
		const { nestedItemsMenu } = await import("../menus/nested-lifecycle-menu.js");
		const featuresDir = ctx.project.config.management?.lifecycle?.featuresDir;
		return nestedItemsMenu(ctx.project.path, "feature", featuresDir);
	});

	registry.registerAction("lifecycle:products", async (ctx) => {
		if (!ctx.project) return undefined;
		const { nestedItemsMenu } = await import("../menus/nested-lifecycle-menu.js");
		const productsDir = ctx.project.config.management?.lifecycle?.productsDir;
		return nestedItemsMenu(ctx.project.path, "product", productsDir);
	});

	// ── Requirements handlers ───────────────────────────────────────

	registry.registerAction("req:list", async (ctx) => {
		if (!ctx.project) return undefined;
		const { listRequirements } = await import("../../domain/requirements/requirement-store.js");
		const { renderRequirementList } = await import("../displays/requirements-display.js");
		renderRequirementList(listRequirements({ disk, paths }, ctx.project.path, ctx.project.config.management?.requirements));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:add-functional", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRequirementInteractive } = await import("../menus/requirements-menu.js");
		await addRequirementInteractive("functional", ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:add-nonfunctional", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRequirementInteractive } = await import("../menus/requirements-menu.js");
		await addRequirementInteractive("non-functional", ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:add-constraint", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addRequirementInteractive } = await import("../menus/requirements-menu.js");
		await addRequirementInteractive("constraint", ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:add-usecase", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addUseCaseInteractive } = await import("../menus/requirements-menu.js");
		await addUseCaseInteractive(ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:add-userstory", async (ctx) => {
		if (!ctx.project) return undefined;
		const { addUserStoryInteractive } = await import("../menus/requirements-menu.js");
		await addUserStoryInteractive(ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("req:update-status", async (ctx) => {
		if (!ctx.project) return undefined;
		const m = await import("../menus/requirements-menu.js");
		await m.updateStatusInteractive(ctx.project.path, ctx.project.config.management?.requirements);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
}
