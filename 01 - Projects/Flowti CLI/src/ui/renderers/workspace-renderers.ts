/**
 * workspace-renderers.ts — Display functions for workspace list, inspect, and prune summary.
 */

import type { AgentWorkspace } from "../../domain/agents/agent-workspace.js";
import type { CollectResult, PruneSummary } from "../../domain/agents/agent-shell.js";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../../infrastructure/ui.js";

const STATE_COLORS: Record<string, string> = {
	provision: YELLOW,
	ready: CYAN,
	active: GREEN,
	collecting: YELLOW,
	disposed: DIM,
	retained: CYAN,
};

export interface WorkspaceListModel {
	readonly workspaces: readonly AgentWorkspace[];
}

export function renderWorkspaceList(model: WorkspaceListModel, log: (msg?: string) => void): void {
	if (model.workspaces.length === 0) {
		log(`\n  ${DIM}No workspaces found.${RESET}\n`);
		return;
	}
	log(`\n  ${BOLD}Workspaces${RESET} (${model.workspaces.length})\n`);
	for (const ws of model.workspaces) {
		const color = STATE_COLORS[ws.state] ?? DIM;
		const age = timeSince(ws.createdAt);
		log(`  ${color}${ws.state.padEnd(11)}${RESET} ${ws.id}  ${DIM}${ws.agentSlug}${RESET}  ${ws.branch}  ${DIM}${ws.method} ${age}${RESET}`);
	}
	log("");
}

export interface WorkspaceInspectModel {
	readonly workspace: AgentWorkspace;
	readonly collectResult: CollectResult | null;
}

export function renderWorkspaceInspect(model: WorkspaceInspectModel, log: (msg?: string) => void): void {
	const ws = model.workspace;
	log(`\n  ${BOLD}${ws.id}${RESET}\n`);
	log(`  Agent:    ${ws.agentSlug}`);
	log(`  Branch:   ${ws.branch} (from ${ws.baseBranch})`);
	log(`  Method:   ${ws.method}`);
	log(`  State:    ${STATE_COLORS[ws.state] ?? ""}${ws.state}${RESET}`);
	log(`  Path:     ${DIM}${ws.path}${RESET}`);
	log(`  Created:  ${ws.createdAt}`);
	if (ws.completedAt) log(`  Completed: ${ws.completedAt}`);
	if (model.collectResult) {
		log(`  Commits:  ${model.collectResult.commits.length}`);
		log(`  Files:    ${model.collectResult.filesChanged} changed`);
		log(`  Turns:    ${model.collectResult.conversationTurns}`);
		if (model.collectResult.errors.length > 0) {
			log(`  ${RED}Errors:  ${model.collectResult.errors.join(", ")}${RESET}`);
		}
	}
	log("");
}

export function renderPruneSummary(model: PruneSummary, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}Pruned:${RESET} ${model.removed} workspaces removed`);
	if (model.skipped > 0) log(`  ${DIM}Skipped: ${model.skipped}${RESET}`);
	if (model.errors.length > 0) {
		for (const err of model.errors) log(`  ${RED}Error: ${err}${RESET}`);
	}
	log("");
}

function timeSince(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(ms / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}
