/**
 * roster-task-menu.ts — Pick an agent from the project roster and assign a task.
 *
 * After selecting an agent, the user sees phase-relevant suggested tasks from the
 * agent's definition plus a custom option. The task is appended to the agent's
 * brief for the current iteration phase.
 */

import { printHeader, RESET, DIM, GREEN, RED, BOLD, CYAN } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, IterationsConfig } from "../../infrastructure/types.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import type { AgentSummary, SuggestedTask } from "../../domain/agents/agent-types.js";
import { getProjectAgents, readSystemPrompt } from "../../domain/agents/agent-store.js";
import { renderAgentList } from "../displays/agents-display.js";
import { findCurrentIteration, iterationsDir } from "../../domain/iterations/iteration-store.js";
import { findBrief, saveBrief, appendTask, generateBrief } from "../../domain/agents/brief-store.js";

export interface RosterTaskOptions {
	readonly projectPath: string;
	readonly iterationsConfig: IterationsConfig | undefined;
	readonly roster: string[] | undefined;
	readonly vaultRoot: string;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly template: LifecycleTemplate | undefined;
}

export async function rosterTaskInteractive(opts: RosterTaskOptions, deps: MenuDeps): Promise<void> {
	printHeader("Assign Task to Agent");

	const iteration = findCurrentIteration(deps, opts.projectPath, opts.iterationsConfig);
	if (!iteration) { deps.log(`\n  ${DIM}No active iteration.${RESET}\n`); return; }

	const agents = getProjectAgents(deps, opts.vaultRoot, opts.agentsConfig, opts.roster);
	if (agents.length === 0) { deps.log(`\n  ${DIM}No agents on the project roster.${RESET}\n`); return; }

	renderAgentList(agents, deps.log);
	const choice = await deps.input.ask("Select agent (number or name)");
	if (!choice) return;

	const agent = resolveAgent(choice, agents);
	if (!agent) { deps.log(`\n  ${RED}Agent "${choice}" not found.${RESET}\n`); return; }

	const task = await promptForTask(agent, iteration.status, deps);
	if (!task) return;

	const phase = iteration.status;
	const dir = iterationsDir(deps, opts.projectPath, opts.iterationsConfig);
	const existing = findBrief(deps, dir, iteration.number, agent.name, phase);

	if (existing) {
		appendTask(deps, dir, iteration.number, agent.name, phase, task);
		deps.log(`\n  ${GREEN}✓${RESET} Task added to ${BOLD}${agent.name}${RESET}'s brief.\n`);
	} else {
		const rosterAgents = agents.map((a) => ({ name: a.name, description: a.description, roles: a.roles, skills: a.skills.map((s) => s.name) }));
		const brief = generateBrief({
			agentName: agent.name, agentDescription: agent.description,
			agentSkills: agent.skills.map((s) => s.name), agentRoles: agent.roles,
			systemPrompt: readSystemPrompt(deps, opts.vaultRoot, agent.name, opts.agentsConfig),
			iteration, iterationTemplate: opts.template, rosterAgents,
		});
		saveBrief(deps, dir, iteration.number, agent.name, phase, brief);
		appendTask(deps, dir, iteration.number, agent.name, phase, task);
		deps.log(`\n  ${GREEN}✓${RESET} Created brief for ${BOLD}${agent.name}${RESET} and added task.\n`);
	}
}

/** Show suggested tasks filtered by phase, plus a custom option. Returns the task or empty string. */
async function promptForTask(agent: AgentSummary, phase: string, deps: MenuDeps): Promise<string> {
	const suggestions = getTasksForPhase(agent.suggestedTasks, phase);
	if (suggestions.length === 0) return deps.input.ask("Task description");

	deps.log("");
	for (let i = 0; i < suggestions.length; i++) {
		deps.log(`  ${CYAN}${i + 1}${RESET}  ${suggestions[i].name}`);
	}
	deps.log(`  ${CYAN}c${RESET}  ${DIM}Custom task...${RESET}`);
	deps.log("");

	const choice = await deps.input.ask("Pick a task or enter (c)ustom");
	if (!choice) return "";
	if (choice.toLowerCase() === "c") return deps.input.ask("Task description");
	const idx = parseInt(choice, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= suggestions.length) return suggestions[idx - 1].name;
	return choice;
}

/** Filter suggested tasks to those relevant for the current phase. */
export function getTasksForPhase(tasks: SuggestedTask[] | undefined, phase: string): SuggestedTask[] {
	if (!tasks || tasks.length === 0) return [];
	return tasks.filter((t) => t.phases.length === 0 || t.phases.includes(phase));
}

function resolveAgent(choice: string, items: AgentSummary[]): AgentSummary | undefined {
	const idx = parseInt(choice, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= items.length) return items[idx - 1];
	return items.find((a) => a.name.toLowerCase() === choice.toLowerCase());
}
