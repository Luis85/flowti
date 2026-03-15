/**
 * agent-task-handlers.ts — Task sub-menu actions for the agent detail page.
 *
 * Extracted from extensibility-handlers.ts to keep file length within limits.
 */

import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { RouterContext } from "../../infrastructure/sitemap-types.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { AgentState } from "../../domain/agents/agent-state.js";
import type { AgentsConfig } from "../../infrastructure/types-config.js";
import { RESET, DIM, GREEN, BOLD, YELLOW } from "../../infrastructure/ui.js";

/** Build menu entries for pending/in-progress tasks. */
export function buildTaskMenuItems(
	state: AgentState,
	agent: AgentSummary,
	showActions: (a: AgentSummary, taskName: string, ctx: RouterContext) => Promise<MenuResult>,
	ctx: RouterContext,
): MenuEntry[] {
	const pending = state.tasks.filter((t) => t.status !== "done");
	if (pending.length === 0) return [];
	return pending.map((task, i) => ({
		key: `t${i + 1}`,
		label: `${task.name} ${task.status === "in-progress" ? YELLOW : DIM}[${task.status}]${RESET}`,
		group: "tasks",
		action: () => showActions(agent, task.name, ctx),
	}));
}

/** Show Open / Done / Remove sub-menu for a single task. */
export async function showTaskActions(
	agent: AgentSummary,
	taskName: string,
	ctx: RouterContext,
	vaultRoot: string,
	agentsConfig: AgentsConfig | undefined,
): Promise<MenuResult> {
	const { runMenu } = await import("../../infrastructure/menu.js");
	const { readAgentState, writeAgentState, completeFirstTask, removeTask } = await import("../../domain/agents/agent-state.js");
	const dir = ctx.deps.paths.join(vaultRoot, ".flowti", "var");

	const items: MenuEntry[] = [
		{ key: "1", label: "Open — dispatch agent with this task", action: async () => {
			await openTask(agent, taskName, ctx, vaultRoot, agentsConfig);
			return undefined;
		}},
		{ key: "2", label: "Done — mark as completed", action: async () => {
			let state = readAgentState(ctx.deps, dir, agent.name);
			state = completeFirstTask(state, taskName);
			writeAgentState(ctx.deps, dir, agent.name, state);
			ctx.deps.log(`\n  ${GREEN}\u2713${RESET} Task "${taskName}" marked done.\n`);
			return undefined;
		}},
		{ key: "3", label: "Remove — delete from task list", action: async () => {
			let state = readAgentState(ctx.deps, dir, agent.name);
			state = removeTask(state, taskName);
			writeAgentState(ctx.deps, dir, agent.name, state);
			ctx.deps.log(`\n  ${GREEN}\u2713${RESET} Task "${taskName}" removed.\n`);
			return undefined;
		}},
	];

	ctx.deps.log(`\n  ${BOLD}Task:${RESET} ${taskName}\n`);
	return runMenu(null, items);
}

/** Try to find an existing brief file matching agent slug + iteration status. */
async function findExistingBrief(agent: AgentSummary, ctx: RouterContext): Promise<string | null> {
	if (!ctx.project) return null;
	try {
		const { findCurrentIteration } = await import("../../domain/iterations/iteration-store.js");
		const iterCfg = ctx.project.config.management?.iterations;
		const iteration = findCurrentIteration(ctx.deps, ctx.project.path, iterCfg);
		if (!iteration) return null;
		const iterDir = ctx.deps.paths.join(ctx.project.path, iterCfg?.dir ?? "iterations");
		const briefDir = ctx.deps.paths.join(iterDir, "briefs");
		if (!ctx.deps.disk.existsSync(briefDir)) return null;
		const files = ctx.deps.disk.readdirSync(briefDir);
		const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const match = files.find((f: string) => f.includes(slug) && f.includes(iteration.status));
		return match ? ctx.deps.paths.join(briefDir, match) : null;
	} catch { return null; }
}

/** Resolve brief path or build fresh prompt, then dispatch the agent. */
async function openTask(
	agent: AgentSummary,
	taskName: string,
	ctx: RouterContext,
	vaultRoot: string,
	agentsConfig: AgentsConfig | undefined,
): Promise<void> {
	const { readSystemPrompt } = await import("../../domain/agents/agent-store.js");
	const { buildConversationPrompt } = await import("../../domain/agents/agent-conversation.js");

	let briefPath = await findExistingBrief(agent, ctx);

	if (!briefPath) {
		const systemPrompt = readSystemPrompt(ctx.deps, vaultRoot, agent.name, agentsConfig);
		const character = {
			description: agent.description, persona: agent.persona,
			mood: agent.mood, personality: agent.personality,
			attributes: agent.attributes, experience: agent.experience,
		};
		const prompt = buildConversationPrompt(agent.name, systemPrompt, [], taskName, character);
		const tempPath = ctx.deps.paths.join(ctx.deps.paths.resolve("."), `.flowti-task-${ctx.deps.clock.ms()}.tmp`);
		ctx.deps.disk.writeFileSync(tempPath, prompt, "utf-8");
		briefPath = tempPath;
	}

	ctx.deps.agentShell.dispatch(agent, briefPath, taskName);
	const who = agent.persona ?? agent.name;
	ctx.deps.log(`\n  ${GREEN}\u2713${RESET} ${who} is working on: ${taskName}\n`);
}
