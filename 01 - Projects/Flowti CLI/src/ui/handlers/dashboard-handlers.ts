/**
 * dashboard-handlers.ts — Sitemap view handler for the agents-dashboard page.
 *
 * Reads agent state files from .flowti/var/ and renders the dashboard display.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { IFileSystem, IPaths } from "../../infrastructure/types.js";
import { VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";
import { agentStore } from "../../domain/agents/agent-store.js";
import type { DashboardAgent, DashboardModel } from "../displays/dashboard-display.js";
import { displayDashboard } from "../displays/dashboard-display.js";

interface AgentDataFile {
	name?: string;
	status?: string;
	tasks?: Array<{ name: string; status: string }>;
	lastInteractionType?: string;
}

function resolveStatus(raw?: string): DashboardAgent["status"] {
	if (raw === "busy") return "busy";
	if (raw === "waiting") return "waiting";
	return "idle";
}

function parseAgentDataFile(
	content: string,
	fileName: string,
	roster: ReadonlyArray<{ name: string; persona?: string }>,
): DashboardAgent {
	const state = JSON.parse(content) as AgentDataFile;
	const agentDef = roster.find((a) => a.name === state.name);
	const activeTask = state.tasks?.find((t) => t.status === "pending" || t.status === "in-progress");
	return {
		name: state.name ?? fileName.replace(/^data-|\.json$/g, ""),
		persona: agentDef?.persona,
		status: resolveStatus(state.status),
		task: activeTask?.name,
		lastInteraction: state.lastInteractionType,
	};
}

function loadRoster(deps: { disk: IFileSystem; paths: IPaths }): Array<{ name: string; persona?: string }> {
	try {
		return agentStore.list(deps as never, VAULT_ROOT, cliConfig.agents ? { dir: cliConfig.agents.dir } : undefined);
	} catch {
		return [];
	}
}

function loadAgentStates(deps: { disk: IFileSystem; paths: IPaths }): DashboardAgent[] {
	const varDir = deps.paths.join(VAULT_ROOT, ".flowti", "var");
	if (!deps.disk.existsSync(varDir)) return [];

	const roster = loadRoster(deps);
	const dataFiles = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
	const activeAgents: DashboardAgent[] = [];

	for (const file of dataFiles) {
		try {
			const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
			activeAgents.push(parseAgentDataFile(content, file, roster));
		} catch { /* skip corrupt files */ }
	}

	for (const agent of roster) {
		if (!activeAgents.some((a) => a.name === agent.name)) {
			activeAgents.push({ name: agent.name, persona: agent.persona, status: "offline" });
		}
	}

	return activeAgents;
}

export function registerDashboardHandlers(registry: HandlerRegistry): void {
	registry.registerView("agents-dashboard", async (ctx) => {
		const agents = loadAgentStates(ctx.deps);
		const model: DashboardModel = {
			agents,
			projectName: ctx.project?.config.name,
		};
		displayDashboard(model, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});
}
