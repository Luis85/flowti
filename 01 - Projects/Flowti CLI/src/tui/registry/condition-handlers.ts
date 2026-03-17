/**
 * condition-handlers.ts — TUI condition handlers for sitemap-driven visibility/disabling.
 *
 * Migrated from the legacy register-handlers.ts condition registrations.
 * Each condition returns true when the associated action should be HIDDEN/DISABLED.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import { findCurrentIteration } from "../../domain/iterations/iteration-store.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";

export function registerConditionHandlers(registry: TuiHandlerRegistry): void {
	registry.registerCondition("no-project-selected", (ctx) => !ctx.project);

	registry.registerCondition("knowledgebase:available", (ctx) => {
		if (!ctx.project) return true;
		return !isKnowledgebaseAvailable(ctx.project.path, ctx.deps);
	});

	registry.registerCondition("readme:exists", (ctx) => {
		if (!ctx.project) return true;
		return !ctx.deps.disk.existsSync(ctx.deps.paths.join(ctx.project.path, "README.md"));
	});

	registry.registerCondition("iteration:running", (ctx) => {
		if (!ctx.project) return false;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return iter !== null;
	});

	registry.registerCondition("iteration:not-running", (ctx) => {
		if (!ctx.project) return true;
		return findCurrentIteration(ctx.deps, ctx.project.path) === null;
	});

	registry.registerCondition("iteration:not-planned", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status !== "planned";
	});

	registry.registerCondition("iteration:cannot-advance", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status === "done" || iter.status === "cancelled";
	});

	registry.registerCondition("iteration:not-in-review", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status !== "in-review";
	});

	registry.registerCondition("agents:dashboard-running", () => {
		// Dashboard state check — stubbed for now (dashboard is TUI-native)
		return false;
	});

	registry.registerCondition("agents:dashboard-not-running", () => {
		return true;
	});
}
