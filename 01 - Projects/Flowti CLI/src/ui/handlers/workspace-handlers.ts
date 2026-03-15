/**
 * workspace-handlers.ts — Sitemap action/view/data-source handlers for the Workspaces page.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import { renderWorkspaceList } from "../renderers/workspace-renderers.js";
import type { IAgentShell } from "../../domain/agents/agent-shell.js";

function getShell(deps: CliDeps): IAgentShell | undefined {
	return deps.agentShell;
}

export function registerWorkspaceHandlers(registry: HandlerRegistry): void {
	registry.registerDataSource("workspace:active-list", (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) return [];
		const workspaces = shell.list();
		const active = workspaces.filter((ws) => ws.state === "active" || ws.state === "ready");
		if (active.length === 0) return [];
		return active.map((ws) => ({
			key: "",
			label: `${ws.agentSlug}: ${ws.branch} (${ws.state})`,
			action: () => undefined,
			disabled: true as const,
		}));
	});

	registry.registerAction("workspace:list", async (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) { ctx.deps.log("  AgentShell not available"); return undefined; }
		const workspaces = shell.list();
		renderWorkspaceList({ workspaces }, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:inspect", async (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) { ctx.deps.log("  AgentShell not available"); return undefined; }
		const workspaces = shell.list();
		if (workspaces.length === 0) { ctx.deps.log("  No workspaces to inspect"); return undefined; }
		renderWorkspaceList({ workspaces }, ctx.deps.log);
		const id = await ctx.deps.input.ask("Workspace ID: ");
		const ws = workspaces.find((w) => w.id === id);
		if (!ws) { ctx.deps.log(`  Not found: ${id}`); return undefined; }
		const { renderWorkspaceInspect } = await import("../renderers/workspace-renderers.js");
		renderWorkspaceInspect({ workspace: ws, collectResult: ws.collectResult }, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:collect", async (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) return undefined;
		const id = await ctx.deps.input.ask("Workspace ID to collect: ");
		const result = await shell.collect(id);
		ctx.deps.log(`  Collected: ${result.commits.length} commits, ${result.filesChanged} files changed`);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:dispose", async (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) return undefined;
		const id = await ctx.deps.input.ask("Workspace ID to dispose: ");
		await shell.dispose(id);
		ctx.deps.log(`  Disposed: ${id}`);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:prune", async (ctx) => {
		const shell = getShell(ctx.deps);
		if (!shell) return undefined;
		const result = await shell.prune();
		const { renderPruneSummary } = await import("../renderers/workspace-renderers.js");
		renderPruneSummary(result, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});
}
