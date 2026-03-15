/**
 * roster-task-menu.ts — Pick an agent from the project roster and assign a task.
 *
 * After selecting an agent, a short clarification chat begins. Once the agent
 * confirms readiness (status "ready") or the user ends the chat, the agent is
 * launched in the background. If the agent is already busy, the task is enqueued.
 * When the agent finishes, it leaves a note in the inbox.
 */

import { printHeader, RESET, DIM, GREEN, RED, BOLD, CYAN } from "../../infrastructure/ui.js";
import type { ShellMenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, IterationsConfig, IAgentShell } from "../../infrastructure/types.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import type { AgentSummary, SuggestedTask } from "../../domain/agents/agent-types.js";
import { getProjectAgents, readSystemPrompt } from "../../domain/agents/agent-store.js";
import { renderAgentList } from "../displays/agents-display.js";
import { findCurrentIteration, iterationsDir } from "../../domain/iterations/iteration-store.js";
import { findBrief, saveBrief, appendTask, generateBrief } from "../../domain/agents/brief-store.js";
import { buildClarificationPrompt } from "../../domain/agents/agent-conversation.js";
import type { AgentCharacter } from "../../domain/agents/agent-conversation.js";

/** Deps for roster task menu — needs agentShell for clarification and dispatch. */
export type RosterTaskDeps = ShellMenuDeps & { readonly agentShell: IAgentShell };

export interface RosterTaskOptions {
	readonly projectPath: string;
	readonly iterationsConfig: IterationsConfig | undefined;
	readonly roster: string[] | undefined;
	readonly vaultRoot: string;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly template: LifecycleTemplate | undefined;
}

export async function rosterTaskInteractive(opts: RosterTaskOptions, deps: RosterTaskDeps): Promise<void> {
	printHeader("Assign Task to Agent");

	const iteration = findCurrentIteration(deps, opts.projectPath, opts.iterationsConfig);
	if (!iteration) { deps.log(`\n  ${DIM}No active iteration.${RESET}\n`); return; }

	const agents = getProjectAgents(deps, opts.vaultRoot, opts.agentsConfig, opts.roster);
	if (agents.length === 0) { deps.log(`\n  ${DIM}No agents on the project roster.${RESET}\n`); return; }

	// Show agent status alongside names
	const { readAgentState } = await import("../../domain/agents/agent-state.js");
	const varDir = deps.paths.join(opts.vaultRoot, ".flowti", "var");

	renderAgentList(agents, deps.log);
	for (const a of agents) {
		const state = readAgentState(deps, varDir, a.name);
		if (state.status === "busy") {
			const who = a.persona ?? a.name;
			deps.log(`  ${DIM}  ${who} is busy — task will be enqueued${RESET}`);
		}
	}

	const choice = await deps.input.ask("Select agent (number or name)");
	if (!choice) return;

	const agent = resolveAgent(choice, agents);
	if (!agent) { deps.log(`\n  ${RED}Agent "${choice}" not found.${RESET}\n`); return; }

	const task = await promptForTask(agent, iteration.status, deps);
	if (!task) return;

	const who = agent.persona ?? agent.name;
	const phase = iteration.status;
	const dir = iterationsDir(deps, opts.projectPath, opts.iterationsConfig);

	// Add task to brief
	const existing = findBrief(deps, dir, iteration.number, agent.name, phase);
	if (existing) {
		appendTask(deps, dir, iteration.number, agent.name, phase, task);
	} else {
		const rosterAgents = agents.map((a) => ({ name: a.name, description: a.description, roles: a.roles, skills: a.skills.map((s) => s.name), mood: a.mood, personality: a.personality }));
		const availableSkills = opts.agentsConfig?.skillMap?.[agent.domain ?? ""];
		const brief = generateBrief({
			agentName: agent.name, agentDescription: agent.description,
			agentSkills: agent.skills.map((s) => s.level ? `${s.name} (${s.level})` : s.name), agentRoles: agent.roles,
			agentPersona: agent.persona, agentMood: agent.mood, agentPersonality: agent.personality, agentAttributes: agent.attributes, agentExperience: agent.experience,
			systemPrompt: readSystemPrompt(deps, opts.vaultRoot, agent.name, opts.agentsConfig),
			iteration, iterationTemplate: opts.template, rosterAgents, availableSkills,
		});
		saveBrief(deps, dir, iteration.number, agent.name, phase, brief);
		appendTask(deps, dir, iteration.number, agent.name, phase, task);
	}

	// Record task in agent state
	const { writeAgentState, addTask: addStateTask } = await import("../../domain/agents/agent-state.js");
	let state = readAgentState(deps, varDir, agent.name);
	state = addStateTask(state, { name: task, assignedAt: deps.clock.iso(), status: "pending", iterationNumber: iteration.number });

	// Check if agent is already busy — enqueue only
	if (state.status === "busy") {
		writeAgentState(deps, varDir, agent.name, state);
		deps.log(`\n  ${GREEN}✓${RESET} Task enqueued for ${BOLD}${who}${RESET} ${DIM}(currently busy)${RESET}\n`);
		return;
	}

	// AI agents get a clarification chat before launch
	if (agent.agentType === "ai" && deps.shell.check("claude --version")) {
		deps.log(`\n  ${DIM}Starting clarification chat with ${who}...${RESET}\n`);
		const launched = await clarifyAndLaunch(agent, task, opts, iteration, dir, deps);
		if (launched) {
			writeAgentState(deps, varDir, agent.name, { ...state, status: "busy" });
			deps.log(`  ${GREEN}✓${RESET} ${BOLD}${who}${RESET} is working on the task. A note will appear in your inbox when done.\n`);
		} else {
			writeAgentState(deps, varDir, agent.name, state);
			deps.log(`\n  ${GREEN}✓${RESET} Task assigned to ${BOLD}${who}${RESET}'s brief.\n`);
		}
	} else {
		writeAgentState(deps, varDir, agent.name, state);
		deps.log(`\n  ${GREEN}✓${RESET} Task assigned to ${BOLD}${who}${RESET}'s brief.\n`);
	}
}

/** Short clarification chat via agentShell.talk(), then launch via agentShell.dispatch(). Returns true if launched. */
async function clarifyAndLaunch(
	agent: AgentSummary, task: string, opts: RosterTaskOptions,
	iteration: import("../../domain/iterations/iteration-types.js").IterationSummary,
	iterDir: string, deps: RosterTaskDeps,
): Promise<boolean> {
	const who = agent.persona ?? agent.name;
	const systemPrompt = readSystemPrompt(deps, opts.vaultRoot, agent.name, opts.agentsConfig);
	const character: AgentCharacter = { description: agent.description, persona: agent.persona, mood: agent.mood, personality: agent.personality, attributes: agent.attributes, experience: agent.experience };
	const history: Array<{ role: "user" | "agent"; content: string }> = [];

	// Initial clarification — agent reviews the task
	const content = buildClarificationPrompt(agent.name, systemPrompt, task, "", "", history, undefined, character);
	const session = deps.agentShell.talk(agent, content);
	const firstResult = await session.result;
	if (!firstResult || !firstResult.response.message) return false;

	history.push({ role: "agent", content: firstResult.response.message });
	deps.log(`\n  ${CYAN}${BOLD}${who}${RESET}`);
	for (const line of firstResult.response.message.split("\n")) deps.log(`    ${line}`);
	deps.log("");

	if (firstResult.response.status === "ready") {
		return launchBackground(agent, task, iterDir, iteration, deps);
	}

	// Clarification loop
	while (true) {
		const reply = await deps.input.ask(`  ${BOLD}You${RESET} ${DIM}(Enter to launch)${RESET}`);
		if (reply === undefined || reply === "") break;
		history.push({ role: "user", content: reply });

		const followUp = buildClarificationPrompt(agent.name, systemPrompt, task, "", "", history, reply, character);
		const followSession = deps.agentShell.talk(agent, followUp);
		const followResult = await followSession.result;
		if (!followResult || !followResult.response.message) break;

		history.push({ role: "agent", content: followResult.response.message });
		deps.log(`\n  ${CYAN}${BOLD}${who}${RESET}`);
		for (const line of followResult.response.message.split("\n")) deps.log(`    ${line}`);
		deps.log("");

		if (followResult.response.status === "ready") break;
	}

	return launchBackground(agent, task, iterDir, iteration, deps);
}

/** Launch agent in background via agentShell.dispatch(). */
function launchBackground(
	agent: AgentSummary, task: string, iterDir: string,
	iteration: import("../../domain/iterations/iteration-types.js").IterationSummary,
	deps: RosterTaskDeps,
): boolean {
	const phase = iteration.status;
	const briefDir = deps.paths.join(iterDir, "briefs");
	const files = deps.disk.existsSync(briefDir) ? deps.disk.readdirSync(briefDir) : [];
	const briefFile = files.find((f) => f.includes(agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) && f.includes(phase));
	if (!briefFile) return false;

	const fullBriefPath = deps.paths.join(briefDir, briefFile);
	deps.agentShell.dispatch(agent, fullBriefPath, task, { iterDir, iterationNumber: iteration.number });
	return true;
}

/** Show suggested tasks filtered by phase, plus a custom option. Returns the task or empty string. */
async function promptForTask(agent: AgentSummary, phase: string, deps: RosterTaskDeps): Promise<string> {
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
