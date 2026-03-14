/**
 * agents-display.ts — Console renderers for agent entities.
 */

import { RESET, DIM, GREEN, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";

export function renderAgentList(agents: AgentSummary[], log: (msg?: string) => void): void {
	if (agents.length === 0) {
		log(`\n  ${DIM}No agents defined yet. Use "Add Agent" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Agents (${agents.length})${RESET}\n`);
	for (let i = 0; i < agents.length; i++) {
		const a = agents[i];
		const typeTag = `${DIM}[${a.agentType}]${RESET}`;
		const domainTag = a.domain ? ` ${DIM}(${a.domain})${RESET}` : "";
		const desc = a.description ? ` ${DIM}— ${a.description}${RESET}` : "";
		log(`  ${CYAN}${i + 1})${RESET} ${a.name} ${typeTag}${domainTag}${desc}`);
	}
	log();
}

export function renderAgentDetail(agent: AgentSummary, log: (msg?: string) => void): void {
	log(`\n  ${BOLD}${agent.name}${RESET} ${DIM}[${agent.agentType}]${RESET}`);
	log(`  ${DIM}Description:${RESET} ${agent.description || "(none)"}`);
	if (agent.domain) log(`  ${DIM}Domain:${RESET} ${agent.domain}`);

	renderNamedList(log, "Skills", agent.skills.map((s) => s.level ? `${s.name}: ${s.level}` : s.name));
	renderNamedList(log, "Tools", agent.tools);
	renderNamedList(log, "Roles", agent.roles);
	renderNamedList(log, "Behaviors", agent.behaviors);
	renderGoals(agent, log);
	renderComponents(agent, log);
	renderAIConfig(agent, log);
	renderRelationships(agent, log);
	log();
}

function renderGoals(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.goals || agent.goals.length === 0) return;
	log(`\n  ${BOLD}Goals${RESET}`);
	for (const g of agent.goals) {
		const prio = g.priority ? ` ${DIM}(priority: ${g.priority})${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${g.name}${prio}`);
	}
}

function renderComponents(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.components || agent.components.length === 0) return;
	log(`\n  ${BOLD}Components${RESET}`);
	for (const c of agent.components) {
		const ctype = c.type ? ` ${DIM}[${c.type}]${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${c.name}${ctype}`);
	}
}

function renderAIConfig(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.ai) return;
	log(`\n  ${BOLD}AI Config${RESET}`);
	if (agent.ai.provider) log(`  ${DIM}Provider:${RESET} ${agent.ai.provider}`);
	if (agent.ai.model) log(`  ${DIM}Model:${RESET} ${agent.ai.model}`);
	if (agent.ai.contextWindow) log(`  ${DIM}Context:${RESET} ${agent.ai.contextWindow} tokens`);
}

function renderRelationships(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.relationships || agent.relationships.length === 0) return;
	log(`\n  ${BOLD}Relationships${RESET}`);
	for (const r of agent.relationships) {
		log(`  ${CYAN}▸${RESET} ${r.type} → ${r.target}${r.description ? ` ${DIM}(${r.description})${RESET}` : ""}`);
	}
}

function renderNamedList(log: (msg?: string) => void, title: string, items?: string[]): void {
	if (!items || items.length === 0) return;
	log(`\n  ${BOLD}${title}${RESET}`);
	for (const item of items) log(`  ${CYAN}▸${RESET} ${item}`);
}

export function renderAgentCreated(relPath: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created agent: ${relPath}`);
}

export function renderAgentDeleted(name: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Deleted agent: ${name}`);
}
