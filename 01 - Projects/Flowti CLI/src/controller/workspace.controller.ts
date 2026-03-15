/**
 * workspace.controller.ts — CLI commands for workspace management.
 *
 * Provides 6 commands under the workspace: namespace:
 * list, inspect, provision, collect, dispose, prune.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { renderWorkspaceList, renderWorkspaceInspect, renderPruneSummary } from "../ui/renderers/workspace-renderers.js";
import type { IAgentShell, CollectResult } from "../domain/agents/agent-shell.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { renderError, type ErrorModel } from "../ui/renderers/common-renderers.js";

function getShell(deps: CliDeps): IAgentShell {
	if (!deps.agentShell) throw new Error("AgentShell not available — workspace commands require agents config");
	return deps.agentShell;
}

function parseDuration(s: string): number {
	const match = s.match(/^(\d+)(ms|s|m|h|d)$/);
	if (!match) return 604_800_000; // default 7d
	const [, num, unit] = match;
	const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return parseInt(num, 10) * (multipliers[unit] ?? 1);
}

type WorkspaceListModel = { workspaces: ReturnType<IAgentShell["list"]> };
type WorkspaceInspectModel = { workspace: ReturnType<IAgentShell["list"]>[number]; collectResult: CollectResult | null } | ErrorModel;
type WorkspaceProvisionModel = { workspace: { id: string; path: string } };
type WorkspaceCollectModel = { commits: readonly string[]; filesChanged: number };

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderInspectOrError(data: WorkspaceInspectModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderWorkspaceInspect(data as { workspace: ReturnType<IAgentShell["list"]>[number]; collectResult: CollectResult | null }, log);
}

export const commands: Record<string, CommandHandler> = {
	"workspace:list": adaptDescriptor<Record<string, unknown>, WorkspaceListModel>({
		handler: (ctx) => {
			const shell = getShell(ctx.deps);
			const workspaces = shell.list();
			return { workspaces };
		},
		renderer: renderWorkspaceList,
	}),

	"workspace:inspect": adaptDescriptor<Record<string, unknown>, WorkspaceInspectModel>({
		rawArgs: true,
		flags: {
			id: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const shell = getShell(ctx.deps);
			const id = ctx.rawArgs?.[0] ?? ((ctx.flags.id as string) || "");
			if (!id) return { error: "Usage: flowti workspace:inspect <id>" } as ErrorModel;

			const workspaces = shell.list();
			const ws = workspaces.find((w) => w.id === id);
			if (!ws) return { error: `Workspace "${id}" not found` } as ErrorModel;

			return { workspace: ws, collectResult: ws.collectResult };
		},
		renderer: renderInspectOrError,
	}),

	"workspace:provision": adaptDescriptor<Record<string, unknown>, WorkspaceProvisionModel>({
		flags: {
			agent: { type: "string", default: "adhoc" },
			branch: { type: "string", default: "" },
			base: { type: "string", default: "" },
		},
		handler: async (ctx) => {
			const shell = getShell(ctx.deps);
			const agent = (ctx.flags.agent as string) || "adhoc";
			const branch = (ctx.flags.branch as string) || undefined;
			const base = (ctx.flags.base as string) || undefined;

			const result = await shell.dispatch({
				agent,
				task: "Manual provision",
				branch,
				baseBranch: base,
			});

			return { workspace: result.workspace };
		},
		renderer: (data, log) => log(`  Provisioned: ${data.workspace.id} at ${data.workspace.path}`),
	}),

	"workspace:collect": adaptDescriptor<Record<string, unknown>, WorkspaceCollectModel>({
		rawArgs: true,
		handler: async (ctx) => {
			const shell = getShell(ctx.deps);
			const id = ctx.rawArgs?.[0] ?? "";
			const result = await shell.collect(id);
			return result;
		},
		renderer: (data, log) => log(`  Collected: ${data.commits.length} commits, ${data.filesChanged} files changed`),
	}),

	"workspace:dispose": adaptDescriptor<Record<string, unknown>, { id: string }>({
		rawArgs: true,
		handler: async (ctx) => {
			const shell = getShell(ctx.deps);
			const id = ctx.rawArgs?.[0] ?? "";
			await shell.dispose(id);
			return { id };
		},
		renderer: (data, log) => log(`  Disposed: ${data.id}`),
	}),

	"workspace:prune": adaptDescriptor({
		flags: {
			"older-than": { type: "string", default: "" },
			"dry-run": { type: "boolean", default: false },
		},
		handler: async (ctx) => {
			const shell = getShell(ctx.deps);
			const olderThanFlag = ctx.flags["older-than"] as string;
			const olderThan = olderThanFlag ? parseDuration(olderThanFlag) : undefined;
			const dryRun = ctx.flags["dry-run"] as boolean;

			return await shell.prune({ olderThan, dryRun });
		},
		renderer: renderPruneSummary,
	}),
};
