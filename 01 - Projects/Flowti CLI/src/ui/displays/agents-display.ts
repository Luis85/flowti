/**
 * agents-display.ts — Console renderers for agent entities.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, YELLOW } from "../../infrastructure/ui.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { AgentState } from "../../domain/agents/agent-state.js";
import { resolvePermissionPolicy, DEFAULT_SAFE_TOOLS } from "../../domain/agents/permission-engine.js";

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
	renderNamedList(log, "Preferred Phases", agent.preferredPhases);
	renderGoals(agent, log);
	renderComponents(agent, log);
	renderAIConfig(agent, log);
	renderRelationships(agent, log);
	renderInventory(agent, log);
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
}

function renderRelationships(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.relationships || agent.relationships.length === 0) return;
	log(`\n  ${BOLD}Relationships${RESET}`);
	for (const r of agent.relationships) {
		log(`  ${CYAN}▸${RESET} ${r.type} → ${r.target}${r.description ? ` ${DIM}(${r.description})${RESET}` : ""}`);
	}
}

function renderInventory(agent: AgentSummary, log: (msg?: string) => void): void {
	if (!agent.inventory || agent.inventory.length === 0) return;
	log(`\n  ${BOLD}Inventory${RESET} ${DIM}(${agent.inventory.length} item${agent.inventory.length === 1 ? "" : "s"})${RESET}`);
	for (const item of agent.inventory) {
		const label = item.label ?? item.path.split("/").pop() ?? item.path;
		log(`  ${CYAN}▸${RESET} ${label} ${DIM}${item.path}${RESET}`);
	}
}

function renderNamedList(log: (msg?: string) => void, title: string, items?: string[]): void {
	if (!items || items.length === 0) return;
	log(`\n  ${BOLD}${title}${RESET}`);
	for (const item of items) log(`  ${CYAN}▸${RESET} ${item}`);
}

const STATUS_COLORS: Record<string, string> = { idle: DIM, active: GREEN, busy: YELLOW };

export function renderAgentState(state: AgentState, log: (msg?: string) => void): void {
	const color = STATUS_COLORS[state.status] ?? DIM;
	log(`\n  ${BOLD}State${RESET}  ${color}${state.status}${RESET}`);
	if (state.lastInteraction) {
		const when = state.lastInteraction.slice(0, 10);
		const what = state.lastInteractionType ?? "unknown";
		log(`  ${DIM}Last interaction:${RESET} ${what} (${when})`);
	}
	if (state.briefs.length > 0) {
		log(`  ${DIM}Briefs generated: ${state.briefs.length}${RESET}`);
	}
}

export function renderAgentCreated(relPath: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created agent: ${relPath}`);
}

export function renderAgentDeleted(name: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Deleted agent: ${name}`);
}

export function renderPermissionInfo(
	agent: AgentSummary,
	state: AgentState,
	log: (msg?: string) => void,
): void {
	if (agent.agentType !== "ai") return;
	const policy = resolvePermissionPolicy(agent.ai?.permissions, state.permissionOverride);
	const alwaysGrants = state.grants.filter((g) => g.scope === "always").length;
	const modeLabel = policy.mode === "auto-allow" ? "auto-allow" : policy.mode;
	const parts = [modeLabel];
	if (policy.mode === "auto-allow") {
		const safeCount = (policy.autoAllowTools ?? DEFAULT_SAFE_TOOLS).length;
		parts.push(`${safeCount} pre-approved`);
	}
	if (alwaysGrants > 0) parts.push(`${alwaysGrants} user grant${alwaysGrants > 1 ? "s" : ""}`);
	log(`  ${DIM}Permission: ${parts.join(", ")}${RESET}`);
	if (state.pendingPermissions.length > 0) {
		log(`  ${YELLOW}${state.pendingPermissions.length} pending permission request${state.pendingPermissions.length > 1 ? "s" : ""}${RESET}`);
	}
}
