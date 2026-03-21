/**
 * agent.controller.ts — CLI commands for agent management.
 *
 * Provides agent:list, agent:task, agent:wake, agent:permission, and agent:dashboard-sync.
 * The agent:start command is a special-case handler registered directly
 * in main.ts because it bypasses adaptDescriptor for persistent
 * stdin/stdout streaming.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { VAULT_ROOT, PROJECTS_DIR, CLI_PROJECT, cliConfig } from "../infrastructure/config.js";
import { agentStore } from "../domain/agents/agent-store.js";
import { readAgentState, writeAgentState, addTask } from "../domain/agents/agent-state.js";
import { syncAgentDashboardAssets } from "../domain/agents/agent-dashboard-sync.js";
import type { SyncAgentDashboardResult } from "../domain/agents/agent-dashboard-sync.js";
import type { AgentActionType } from "../domain/agents/world-state-types.js";

// ── Data models ──────────────────────────────────────────────────────

interface AgentListEntry {
	readonly name: string;
	readonly domain: string | undefined;
	readonly status: string;
}

interface AgentListModel {
	readonly agents: readonly AgentListEntry[];
}

interface AgentTaskModel {
	readonly ok: boolean;
	readonly taskId: string;
}

interface AgentWakeModel {
	readonly ok: boolean;
	readonly state: string;
}

interface AgentPermissionModel {
	readonly ok: boolean;
}

// ── Renderers ────────────────────────────────────────────────────────

function renderAgentList(model: AgentListModel, log: LogFn): void {
	if (model.agents.length === 0) {
		log("\n  No agents found.\n");
		return;
	}
	log("");
	for (const agent of model.agents) {
		const domain = agent.domain ? ` (${agent.domain})` : "";
		log(`  ${agent.name}${domain} — ${agent.status}`);
	}
	log("");
}

function renderAgentTask(model: AgentTaskModel, log: LogFn): void {
	log(`\n  Task assigned: ${model.taskId}\n`);
}

function renderAgentWake(model: AgentWakeModel, log: LogFn): void {
	log(`\n  Agent woken — state: ${model.state}\n`);
}

function renderAgentPermission(model: AgentPermissionModel, log: LogFn): void {
	if (model.ok) {
		log("\n  Permission updated.\n");
	}
}

function renderAgentDashboardSync(model: SyncAgentDashboardResult, log: LogFn): void {
	log("\n  Agent dashboard data regenerated.");
	log(`  ${model.jsonPath}`);
	log(`  Agents: ${model.agentCount}, projects: ${model.projectCount}`);
	if (model.staticBundle === "ok") {
		log("  Static bundle: ready.\n");
	} else if (model.staticBundle === "skipped") {
		log("  Static bundle: skipped (enable agents.dashboard in project config to build).\n");
	} else {
		log(`  Static bundle: failed — ${model.staticError ?? "unknown error"}\n`);
	}
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"agent:list": adaptDescriptor<Record<string, unknown>, AgentListModel>({
		handler: (ctx) => {
			const agents = agentStore.list(
				ctx.deps,
				VAULT_ROOT,
				cliConfig.agents ? { dir: cliConfig.agents.dir } : undefined,
			);
			const worldState = ctx.deps.worldState.getState();
			const entries: AgentListEntry[] = agents.map((a) => {
				const entity = worldState.entities[a.name];
				const status = entity
					? String((entity.components as Record<string, unknown>).status ?? "idle")
					: "idle";
				return { name: a.name, domain: a.domain, status };
			});
			return { agents: entries };
		},
		renderer: renderAgentList,
	}),

	"agent:task": adaptDescriptor<{ agent: string; task: string }, AgentTaskModel>({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			task: { type: "string", required: true, hint: "--task=<description>" },
		},
		handler: (ctx) => {
			const { agent: agentName, task: taskText } = ctx.flags;
			const varDir = ctx.deps.paths.join(VAULT_ROOT, ".flowti", "var");
			const state = readAgentState(ctx.deps, varDir, agentName);
			const taskId = `task-${ctx.deps.clock.ms()}`;
			const updated = addTask(state, {
				name: taskText,
				assignedAt: ctx.deps.clock.iso(),
				status: "pending",
			});
			writeAgentState(ctx.deps, varDir, agentName, updated);

			ctx.deps.worldState.emitAction({
				id: taskId,
				agentName,
				timestamp: ctx.deps.clock.iso(),
				type: "task-started" as AgentActionType,
				data: { task: taskText },
			});

			return { ok: true, taskId };
		},
		renderer: renderAgentTask,
	}),

	"agent:wake": adaptDescriptor<{ agent: string }, AgentWakeModel>({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const { agent: agentName } = ctx.flags;
			let worker = ctx.deps.workerManager.getWorker(agentName);
			if (!worker) {
				worker = ctx.deps.workerManager.spawn(agentName);
			}
			const workerState = worker ? worker.state : "stopped";
			return { ok: true, state: workerState };
		},
		renderer: renderAgentWake,
	}),

	"agent:permission": adaptDescriptor<{ agent: string; tool: string; decision: string }, AgentPermissionModel>({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			tool: { type: "string", required: true, hint: "--tool=<tool-name>" },
			decision: { type: "string", required: true, choices: ["allow", "deny"], hint: "--decision=allow|deny" },
		},
		handler: (ctx) => {
			const { agent: agentName, tool, decision } = ctx.flags;
			const actionType: AgentActionType = decision === "allow" ? "permission-granted" : "permission-denied";

			ctx.deps.worldState.emitAction({
				id: `perm-${ctx.deps.clock.ms()}`,
				agentName,
				timestamp: ctx.deps.clock.iso(),
				type: actionType,
				data: { tool },
			});

			return { ok: true };
		},
		renderer: renderAgentPermission,
	}),

	"agent:dashboard-sync": adaptDescriptor<{ dir: string }, SyncAgentDashboardResult>({
		flags: {
			dir: { type: "string", default: ".flowti/agents", hint: "--dir=<path>" },
		},
		handler: (ctx) => {
			const { paths } = ctx.deps;
			const dirFlag = ctx.flags.dir as string;
			const rootDir = paths.isAbsolute(dirFlag) ? dirFlag : paths.resolve(dirFlag);

			const result = syncAgentDashboardAssets(
				{
					rootDir,
					cliProjectPath: CLI_PROJECT,
					projectsDir: PROJECTS_DIR,
					vaultRoot: VAULT_ROOT,
					projectAgentsConfig: ctx.project?.config?.agents,
					vaultAgentsConfig: cliConfig.agents,
				},
				ctx.deps,
			);

			return {
				ok: true,
				jsonPath: result.jsonPath,
				agentCount: result.agentCount,
				projectCount: result.projectCount,
				staticBundle: result.staticBundle,
				staticError: result.staticError,
			};
		},
		renderer: renderAgentDashboardSync,
	}),
};
