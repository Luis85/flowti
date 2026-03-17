/**
 * data-source-handlers.ts — TUI data source handlers for dynamic menu lists.
 *
 * Data source handlers return MenuEntry[] for dynamic lists in the sitemap-driven TUI.
 * Initial implementations return empty arrays — actual data loading will be
 * wired to domain stores in later iterations.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerDataSourceHandlers(registry: TuiHandlerRegistry): void {
	// Agent list data source
	registry.registerDataSource("agents:list", (ctx) => {
		if (!ctx.project) return [];
		// Read agents from agentsConfig — returns MenuEntry[] for dynamic lists
		return [];
	});

	// Inbox agent notes
	registry.registerDataSource("inbox:agent-notes", (ctx) => {
		const inboxDir = ctx.deps.paths.join(ctx.project?.path ?? "", "00 - Connectivity", "inbox");
		if (!ctx.deps.disk.existsSync(inboxDir)) return [];
		return [];
	});

	// Make templates
	registry.registerDataSource("make:templates", (ctx) => {
		if (!ctx.project) return [];
		return [];
	});

	// Reports generators
	registry.registerDataSource("reports:generators", (ctx) => {
		if (!ctx.project) return [];
		return [];
	});
}
