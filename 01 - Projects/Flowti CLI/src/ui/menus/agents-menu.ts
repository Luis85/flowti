/**
 * agents-menu.ts — Interactive agent management menus.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types.js";
import { listAgents, findAgent, createAgent, deleteAgent, updateAgentField, addArrayItem, removeArrayItem, updateAgentJson, readSystemPrompt, writeSystemPrompt } from "../../domain/agents/agent-store.js";
import type { AgentDefinition, AgentSkill, AgentType, AgentSummary } from "../../domain/agents/agent-types.js";
import { renderAgentList, renderAgentDetail, renderAgentCreated, renderAgentDeleted } from "../displays/agents-display.js";
import type { MenuResult } from "../../infrastructure/types.js";

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

// ── Agent detail view ────────────────────────────────────────────────

/** Agent detail page — shows agent and returns a menu action. */
export async function agentDetailMenu(projectPath: string, agentName: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<MenuResult> {
	const agent = findAgent(deps, projectPath, agentName, config);
	if (!agent) {
		deps.log(`\n  Agent "${agentName}" not found.\n`);
		return "main";
	}
	renderAgentDetail(agent, deps.log);
	return undefined; // handled by sitemap actions
}

// ── Agent editing ────────────────────────────────────────────────────

export async function editAgentIdentity(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const desc = await deps.input.ask("Description", agent.description);
	if (desc !== agent.description) updateAgentField(deps, projectPath, agent.name, "description", desc, config);
	const domain = await deps.input.ask("Domain (optional)", agent.domain ?? "");
	if (domain !== (agent.domain ?? "")) updateAgentField(deps, projectPath, agent.name, "domain", domain, config);
	deps.log("\n  Identity updated.\n");
}

export async function editAgentSkills(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Skills");
	if (agent.skills.length > 0) {
		deps.log("  Current skills:");
		for (const s of agent.skills) deps.log(`    ${s.name}: ${s.level || "(unrated)"}`);
	}
	const action = await deps.input.ask("(a)dd / (r)emove / Enter to skip", "");
	if (action === "a") await addSkillFlow(projectPath, agent.name, config, deps);
	else if (action === "r") await removeSkillFlow(projectPath, agent, config, deps);
}

async function addSkillFlow(projectPath: string, agentName: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const name = await deps.input.ask("Skill name");
	if (!name) return;
	const level = await deps.input.ask("Level (optional)", "");
	addArrayItem(deps, projectPath, agentName, "skills", level ? `${name}|${level}` : name, config);
	deps.log(`  Added skill: ${name}\n`);
}

async function removeSkillFlow(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const name = await deps.input.ask("Skill name to remove");
	if (!name) return;
	const match = agent.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
	if (!match) { deps.log(`  Skill "${name}" not found.\n`); return; }
	removeArrayItem(deps, projectPath, agent.name, "skills", match.level ? `${match.name}|${match.level}` : match.name, config);
	deps.log(`  Removed skill: ${match.name}\n`);
}

function resolveArrayItems(agent: AgentSummary, field: "tools" | "roles" | "behaviors"): string[] {
	if (field === "tools") return agent.tools;
	if (field === "roles") return agent.roles;
	return agent.behaviors ?? [];
}

export async function editAgentArrayField(projectPath: string, agent: AgentSummary, field: "tools" | "roles" | "behaviors", config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader(`Edit ${field}`);
	const items = resolveArrayItems(agent, field);
	if (items.length > 0) {
		deps.log(`  Current ${field}:`);
		for (const item of items) deps.log(`    ${item}`);
	}
	const action = await deps.input.ask("(a)dd / (r)emove / Enter to skip", "");
	if (action === "a") await addArrayFieldItem(projectPath, agent.name, field, config, deps);
	else if (action === "r") await removeArrayFieldItem(projectPath, agent.name, items, field, config, deps);
}

async function addArrayFieldItem(projectPath: string, agentName: string, field: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const item = await deps.input.ask(`${field.slice(0, -1)} name`);
	if (!item) return;
	addArrayItem(deps, projectPath, agentName, field, item, config);
	deps.log(`  Added: ${item}\n`);
}

async function removeArrayFieldItem(projectPath: string, agentName: string, items: string[], field: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	const item = await deps.input.ask(`${field.slice(0, -1)} to remove`);
	if (!item) return;
	const found = items.find((i) => i.toLowerCase() === item.toLowerCase());
	if (!found) { deps.log(`  "${item}" not found.\n`); return; }
	removeArrayItem(deps, projectPath, agentName, field, found, config);
	deps.log(`  Removed: ${found}\n`);
}

export async function editAIConfigInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("AI Configuration");
	const current = agent.ai ?? {};
	const model = await deps.input.ask("Model", current.model ?? "");
	const provider = await deps.input.ask("Provider", current.provider ?? "");
	const contextStr = await deps.input.ask("Context window (tokens)", current.contextWindow ? String(current.contextWindow) : "");
	const maxStr = await deps.input.ask("Max tokens", current.maxTokens ? String(current.maxTokens) : "");
	const contextWindow = parseInt(contextStr, 10) || undefined;
	const maxTokens = parseInt(maxStr, 10) || undefined;
	updateAgentJson(deps, projectPath, agent.name, {
		ai: { model: model || undefined, provider: provider || undefined, contextWindow, maxTokens, systemPrompt: current.systemPrompt },
	}, config);
	deps.log("\n  AI config updated.\n");
}

export async function editSystemPromptInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("System Prompt");
	const current = readSystemPrompt(deps, projectPath, agent.name, config);
	if (current) {
		deps.log(`  Current prompt (${current.length} chars):\n`);
		deps.log(current.split("\n").slice(0, 5).map((l) => `  ${l}`).join("\n"));
		if (current.split("\n").length > 5) deps.log("  ...");
		deps.log("");
	} else {
		deps.log("  No system prompt file yet.\n");
	}
	const content = await deps.input.ask("New prompt (or Enter to skip)");
	if (!content) return;
	writeSystemPrompt(deps, projectPath, agent.name, content, config);
	deps.log("  System prompt saved.\n");
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
