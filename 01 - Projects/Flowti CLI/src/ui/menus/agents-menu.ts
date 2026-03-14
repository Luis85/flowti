/** agents-menu.ts — Interactive agent management menus. */
import { printHeader, RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import { listAgents, createAgent, deleteAgent, updateAgentField, addArrayItem, removeArrayItem, updateAgentJson, readSystemPrompt, writeSystemPrompt } from "../../domain/agents/agent-store.js";
import type { AgentDefinition, AgentSkill, AgentType, AgentSummary } from "../../domain/agents/agent-types.js";
import { renderAgentList, renderAgentCreated, renderAgentDeleted } from "../displays/agents-display.js";
import { updateProjectConfig } from "../../domain/project/project-config.js";

// Re-export interact functions for backward compatibility
export { talkToAgentInteractive, assignTaskInteractive, assignToProjectInteractive } from "./agents-interact-menu.js";

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

export async function removeAgentInteractive(projectPath: string, config: AgentsConfig | undefined, deps: MenuDeps): Promise<boolean> {
	printHeader("Remove Agent");
	const agents = listAgents(deps, projectPath, config);
	if (agents.length === 0) {
		deps.log("\n  No agents to remove.\n");
		return false;
	}
	renderAgentList(agents, deps.log);
	const choice = await deps.input.ask("Select agent to remove (number or name)");
	if (!choice) return false;
	const idx = parseInt(choice, 10);
	const agent = (!isNaN(idx) && idx >= 1 && idx <= agents.length)
		? agents[idx - 1]
		: agents.find((a) => a.name.toLowerCase() === choice.toLowerCase());
	if (!agent) {
		deps.log(`\n  Agent "${choice}" not found.\n`);
		return false;
	}
	const confirm = await deps.input.askYesNo(`Remove "${agent.name}"?`);
	if (!confirm) return false;
	const ok = deleteAgent(deps, projectPath, agent.name, config);
	if (ok) renderAgentDeleted(agent.name, deps.log);
	return ok;
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

// ── Project Agent Roster ─────────────────────────────────────────────

export async function manageProjectAgentsInteractive(
	projectPath: string, projectConfig: ProjectConfig, vaultRoot: string, vaultAgentsConfig: AgentsConfig | undefined, deps: MenuDeps,
): Promise<void> {
	printHeader("Manage Project Agents");

	const roster = projectConfig.management?.agents?.roster ?? [];
	if (roster.length > 0) {
		deps.log("  Current roster:");
		for (const name of roster) deps.log(`    ${DIM}•${RESET} ${name}`);
		deps.log("");
	} else {
		deps.log(`  ${DIM}No agents assigned to this project yet.${RESET}\n`);
	}

	const action = await deps.input.ask("(a)dd / (r)emove / Enter to skip", "");
	if (action === "a") await addToRoster(projectPath, projectConfig, vaultRoot, vaultAgentsConfig, roster, deps);
	else if (action === "r") await removeFromRoster(projectPath, projectConfig, roster, deps);
}

function resolveByNameOrIndex<T extends { name: string }>(choice: string, items: T[]): T | undefined {
	const idx = parseInt(choice, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= items.length) return items[idx - 1];
	return items.find((a) => a.name.toLowerCase() === choice.toLowerCase());
}

function persistRoster(projectPath: string, projectConfig: ProjectConfig, newRoster: string[], deps: MenuDeps): boolean {
	const ok = updateProjectConfig(projectPath, deps, (cfg) => {
		if (!cfg.management) cfg.management = {};
		if (!cfg.management.agents) cfg.management.agents = {};
		cfg.management.agents.roster = newRoster;
	});
	if (ok) {
		projectConfig.management = projectConfig.management ?? {};
		projectConfig.management.agents = projectConfig.management.agents ?? {};
		projectConfig.management.agents.roster = newRoster;
	}
	return ok;
}

async function addToRoster(
	projectPath: string, projectConfig: ProjectConfig, vaultRoot: string, vaultAgentsConfig: AgentsConfig | undefined, roster: string[], deps: MenuDeps,
): Promise<void> {
	const allAgents = listAgents(deps, vaultRoot, vaultAgentsConfig);
	const rosterSet = new Set(roster.map((n) => n.toLowerCase()));
	const available = allAgents.filter((a) => !rosterSet.has(a.name.toLowerCase()));

	if (available.length === 0) {
		deps.log(`  ${DIM}All vault agents are already on the roster.${RESET}\n`);
		return;
	}

	deps.log("  Available agents:");
	for (let i = 0; i < available.length; i++) {
		deps.log(`    ${i + 1}. ${available[i].name} ${DIM}[${available[i].agentType}]${RESET}`);
	}

	const choice = await deps.input.ask("Agent name or number");
	if (!choice) return;

	const agent = resolveByNameOrIndex(choice, available);
	if (!agent) {
		deps.log(`  ${RED}Agent "${choice}" not found.${RESET}\n`);
		return;
	}

	if (persistRoster(projectPath, projectConfig, [...roster, agent.name], deps)) {
		deps.log(`  ${GREEN}✓${RESET} Added ${agent.name} to project roster.\n`);
	}
}

async function removeFromRoster(projectPath: string, projectConfig: ProjectConfig, roster: string[], deps: MenuDeps): Promise<void> {
	if (roster.length === 0) {
		deps.log(`  ${DIM}Roster is empty.${RESET}\n`);
		return;
	}

	const choice = await deps.input.ask("Agent name to remove");
	if (!choice) return;

	const match = roster.find((n) => n.toLowerCase() === choice.toLowerCase());
	if (!match) {
		deps.log(`  ${RED}"${choice}" not on roster.${RESET}\n`);
		return;
	}

	if (persistRoster(projectPath, projectConfig, roster.filter((n) => n !== match), deps)) {
		deps.log(`  ${GREEN}✓${RESET} Removed ${match} from project roster.\n`);
	}
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
