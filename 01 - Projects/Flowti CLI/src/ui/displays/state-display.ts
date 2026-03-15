/**
 * state-display.ts — Terminal rendering of world state.
 *
 * Renders agent status, project entities, and recent activity log.
 */

import { RESET, DIM, GREEN, YELLOW, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { WorldState, WorldEntity, ActivityEntry } from "../../infrastructure/types.js";

const ACTION_COLORS: Record<string, string> = {
	"using-tool": YELLOW, "thinking": DIM, "speaking": GREEN,
	"asking": CYAN, "requesting-permission": RED, "error": RED,
	"task-started": GREEN, "task-completed": GREEN, "idle": DIM,
};

const STATE_COLORS: Record<string, string> = {
	busy: YELLOW, idle: DIM, waiting: CYAN, error: RED,
};

function resolveEntityColor(state: string): string {
	return STATE_COLORS[state] ?? RED;
}

function resolveEntityDetail(status: { currentAction?: string; toolName?: string; task?: string; state?: string } | undefined): string {
	if (status?.toolName) return `using tool: ${status.toolName}`;
	if (status?.task) return `task: ${status.task}`;
	return status?.currentAction ?? status?.state ?? "unknown";
}

function renderEntitySummary(entity: WorldEntity, log: (msg?: string) => void): void {
	const status = entity.components.status as { state?: string; currentAction?: string; toolName?: string; task?: string } | undefined;
	const identity = entity.components.identity as { persona?: string; agentType?: string } | undefined;
	const state = status?.state ?? "unknown";
	const color = resolveEntityColor(state);
	const name = identity?.persona ? `${identity.persona} (${entity.id})` : entity.id;
	const detail = resolveEntityDetail(status);
	log(`  ${CYAN}${name}${RESET} ${DIM}[${identity?.agentType ?? entity.type}]${RESET} — ${color}${detail}${RESET}`);
}

function renderProjectSummary(project: WorldEntity, log: (msg?: string) => void): void {
	const iter = project.components.iteration as { name?: string; status?: string } | undefined;
	const roster = project.components.roster as { agents?: string[] } | undefined;
	log(`  ${CYAN}${project.id}${RESET} — ${iter?.name ?? "no iteration"} ${DIM}[${iter?.status ?? ""}]${RESET} — ${roster?.agents?.length ?? 0} agents`);
}

function renderAgentsSection(agents: readonly WorldEntity[], log: (msg?: string) => void): void {
	log(`  ${BOLD}Agents${RESET} (${agents.length})`);
	for (const a of agents) renderEntitySummary(a, log);
	log("");
}

function renderProjectsSection(projects: readonly WorldEntity[], log: (msg?: string) => void): void {
	log(`  ${BOLD}Projects${RESET} (${projects.length})`);
	for (const p of projects) renderProjectSummary(p, log);
	log("");
}

function renderActivitySection(entries: readonly ActivityEntry[], log: (msg?: string) => void): void {
	log(`  ${BOLD}Recent Activity${RESET}`);
	const recent = entries.slice(-10);
	for (const entry of recent) renderActivityEntry(entry, log);
	log("");
}

export function renderWorldStateSummary(state: WorldState, log: (msg?: string) => void): void {
	const ago = Date.now() - new Date(state.updatedAt).getTime();
	const agoStr = ago < 60_000 ? `${Math.round(ago / 1000)}s ago` : `${Math.round(ago / 60_000)}m ago`;
	log(`\n  ${BOLD}World State${RESET} ${DIM}(updated ${agoStr})${RESET}\n`);

	const agents = Object.values(state.entities).filter((e) => e.type === "agent");
	const projects = Object.values(state.entities).filter((e) => e.type === "project");

	if (agents.length > 0) renderAgentsSection(agents, log);
	if (projects.length > 0) renderProjectsSection(projects, log);
	if (state.activityLog.length > 0) renderActivitySection(state.activityLog, log);
}

function renderActivityEntry(entry: ActivityEntry, log: (msg?: string) => void): void {
	const time = entry.timestamp.slice(11, 19);
	const color = ACTION_COLORS[entry.type] ?? DIM;
	log(`  ${DIM}${time}${RESET}  ${CYAN}${entry.agentName}${RESET}  ${color}${entry.summary}${RESET}`);
}

export function renderEntityDetail(entity: WorldEntity, log: (msg?: string) => void): void {
	log(`\n  ${BOLD}${entity.id}${RESET} ${DIM}[${entity.type}]${RESET}\n`);
	for (const [key, value] of Object.entries(entity.components)) {
		log(`  ${BOLD}${key}${RESET}: ${DIM}${JSON.stringify(value)}${RESET}`);
	}
	log("");
}
