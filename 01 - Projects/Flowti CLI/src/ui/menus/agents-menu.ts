/**
 * agents-menu.ts — Interactive agent management menus.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types.js";
import { listAgents, createAgent, deleteAgent } from "../../domain/agents/agent-store.js";
import type { AgentDefinition, AgentSkill, AgentType } from "../../domain/agents/agent-types.js";
import { renderAgentList, renderAgentDetail, renderAgentCreated, renderAgentDeleted } from "../displays/agents-display.js";

export async function addAgentInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<boolean> {
	printHeader("Add Agent");

	const name = await deps.input.ask("Agent name");
	if (!name) return false;

	const typeStr = await deps.input.ask("Type (human/ai)", "human");
	const agentType: AgentType = typeStr === "ai" ? "ai" : "human";

	const description = await deps.input.ask("Description (optional)", "");

	const skills = await collectSkills(deps);
	const tools = await collectList(deps, "Tool");
	const roles = await collectList(deps, "Role");

	const def: AgentDefinition = { name, agentType, description, skills, tools, roles };
	const filePath = createAgent(deps, projectPath, def, config);
	if (filePath) {
		renderAgentCreated(deps.paths.relative(projectPath, filePath), deps.log);
		return true;
	}
	deps.log(`\n  Agent "${name}" already exists.`);
	return false;
}

export async function viewAgentInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const agents = listAgents(deps, projectPath, config);
	if (agents.length === 0) {
		deps.log("\n  No agents defined.\n");
		return;
	}
	renderAgentList(agents, deps.log);
	const name = await deps.input.ask("Agent name to view");
	if (!name) return;
	const agent = agents.find((a) => a.name.toLowerCase() === name.toLowerCase());
	if (!agent) {
		deps.log(`\n  Agent "${name}" not found.\n`);
		return;
	}
	renderAgentDetail(agent, deps.log);
}

export async function listAgentsInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const agents = listAgents(deps, projectPath, config);
	renderAgentList(agents, deps.log);
}

export async function removeAgentInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<boolean> {
	printHeader("Remove Agent");
	const agents = listAgents(deps, projectPath, config);
	if (agents.length === 0) {
		deps.log("\n  No agents to remove.\n");
		return false;
	}
	renderAgentList(agents, deps.log);
	const name = await deps.input.ask("Agent name to remove");
	if (!name) return false;
	const agent = agents.find((a) => a.name.toLowerCase() === name.toLowerCase());
	if (!agent) {
		deps.log(`\n  Agent "${name}" not found.\n`);
		return false;
	}
	const confirm = await deps.input.askYesNo(`Remove "${agent.name}"?`);
	if (!confirm) return false;
	const ok = deleteAgent(deps, projectPath, agent.name, config);
	if (ok) renderAgentDeleted(agent.name, deps.log);
	return ok;
}

/** Select an existing agent by name — returns the agent name or null. */
export async function selectAgentInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<string | null> {
	const agents = listAgents(deps, projectPath, config);
	if (agents.length === 0) {
		deps.log("\n  No agents defined. Create one first.\n");
		return null;
	}
	renderAgentList(agents, deps.log);
	const name = await deps.input.ask("Agent name");
	if (!name) return null;
	const match = agents.find((a) => a.name.toLowerCase() === name.toLowerCase());
	return match ? match.name : null;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function collectSkills(deps: MenuDeps): Promise<AgentSkill[]> {
	const skills: AgentSkill[] = [];
	const addSkill = await deps.input.askYesNo("Add skills?");
	if (!addSkill) return skills;
	for (;;) {
		const name = await deps.input.ask("Skill name");
		if (!name) break;
		const level = await deps.input.ask("Proficiency level (optional)", "");
		skills.push({ name, level });
		const more = await deps.input.askYesNo("Add another skill?");
		if (!more) break;
	}
	return skills;
}

async function collectList(deps: MenuDeps, label: string): Promise<string[]> {
	const items: string[] = [];
	const add = await deps.input.askYesNo(`Add ${label.toLowerCase()}s?`);
	if (!add) return items;
	for (;;) {
		const item = await deps.input.ask(`${label} name`);
		if (!item) break;
		items.push(item);
		const more = await deps.input.askYesNo(`Add another ${label.toLowerCase()}?`);
		if (!more) break;
	}
	return items;
}
