/**
 * navigation-handlers.ts — TUI navigation handlers.
 *
 * Navigation handlers return { kind: "navigate", target } results.
 * These cover actions that were previously terminal-interactive but now
 * just navigate to a page in the sitemap-driven TUI.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerNavigationHandlers(registry: TuiHandlerRegistry): void {
	// Project management
	registry.registerHandler("project:open", async () => ({ kind: "navigate", target: "projects-list" }));
	registry.registerHandler("project:create", async () => ({ kind: "navigate", target: "project-create" }));

	// Agent management
	registry.registerHandler("agents:navigate-edit", async (ctx) => {
		const agentId = ctx.params?.agentId;
		return { kind: "navigate", target: "agent-detail", params: agentId ? { agentId } : undefined };
	});

	// Events
	registry.registerHandler("events:list", async () => ({ kind: "navigate", target: "event-catalog" }));

	// Lifecycle
	registry.registerHandler("lifecycle:project", async () => ({ kind: "navigate", target: "lifecycle" }));

	// Component navigation
	registry.registerHandler("comp:add", async () => ({ kind: "navigate", target: "scaffold" }));

	// Help
	registry.registerHandler("help:main", async () => ({ kind: "navigate", target: "help" }));
	registry.registerHandler("info:show", async () => ({ kind: "navigate", target: "project-detail" }));

	// Workspace
	registry.registerHandler("workspace:list", async () => ({ kind: "navigate", target: "workspaces" }));
}
