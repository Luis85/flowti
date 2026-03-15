/**
 * workspace.controller.ts — CLI commands for workspace management.
 *
 * Provides 6 commands under the workspace: namespace:
 * list, inspect, provision, collect, dispose, prune.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import { renderWorkspaceList, renderWorkspaceInspect, renderPruneSummary } from "../ui/renderers/workspace-renderers.js";
import type { IAgentShell } from "../domain/agents/agent-shell.js";

function getShell(req: { deps: { agentShell?: IAgentShell } }): IAgentShell {
	if (!req.deps.agentShell) throw new Error("AgentShell not available — workspace commands require agents config");
	return req.deps.agentShell;
}

const actions: Record<string, ControllerAction> = {
	"workspace:list": (req) => {
		const shell = getShell(req);
		const workspaces = shell.list();
		return dataResponse({ workspaces }, (d) => renderWorkspaceList(d, req.deps.log));
	},

	"workspace:inspect": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? (typeof req.flags.id === "string" ? req.flags.id : "");
		if (!id) return dataResponse({ error: "Usage: flowti workspace:inspect <id>" }, (d) => req.deps.log(`  ${d.error}`));

		const workspaces = shell.list();
		const ws = workspaces.find((w) => w.id === id);
		if (!ws) return dataResponse({ error: `Workspace "${id}" not found` }, (d) => req.deps.log(`  ${d.error}`));

		return dataResponse(
			{ workspace: ws, collectResult: ws.collectResult },
			(d) => renderWorkspaceInspect(d, req.deps.log),
		);
	},

	"workspace:provision": async (req) => {
		const shell = getShell(req);
		const agent = typeof req.flags.agent === "string" ? req.flags.agent : "adhoc";
		const branch = typeof req.flags.branch === "string" ? req.flags.branch : undefined;
		const base = typeof req.flags.base === "string" ? req.flags.base : undefined;

		const result = await shell.dispatch({
			agent,
			task: "Manual provision",
			branch,
			baseBranch: base,
		});

		return dataResponse(
			{ workspace: result.workspace },
			(d) => req.deps.log(`  Provisioned: ${d.workspace.id} at ${d.workspace.path}`),
		);
	},

	"workspace:collect": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? "";
		const result = await shell.collect(id);
		return dataResponse(result, (d) => req.deps.log(`  Collected: ${d.commits.length} commits, ${d.filesChanged} files changed`));
	},

	"workspace:dispose": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? "";
		await shell.dispose(id);
		return dataResponse({ id }, (d) => req.deps.log(`  Disposed: ${d.id}`));
	},

	"workspace:prune": async (req) => {
		const shell = getShell(req);
		const olderThan = typeof req.flags["older-than"] === "string"
			? parseDuration(req.flags["older-than"])
			: undefined;
		const dryRun = req.flags["dry-run"] === true;

		const result = await shell.prune({ olderThan, dryRun });
		return dataResponse(result, (d) => renderPruneSummary(d, req.deps.log));
	},
};

function parseDuration(s: string): number {
	const match = s.match(/^(\d+)(ms|s|m|h|d)$/);
	if (!match) return 604_800_000; // default 7d
	const [, num, unit] = match;
	const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return parseInt(num, 10) * (multipliers[unit] ?? 1);
}

export const commands: Record<string, ReturnType<typeof adapt>> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
