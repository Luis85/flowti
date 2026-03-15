/**
 * agent-workspace.ts — AgentWorkspace entity and state machine.
 *
 * Represents an isolated workspace (worktree or clone) where an agent
 * runs autonomously. The state machine enforces valid lifecycle transitions:
 *
 *   provision -> ready -> active -> collecting -> disposed
 *                                             -> retained -> disposed
 */

import type { CollectResult } from "./agent-shell.js";

export type WorkspaceState = "provision" | "ready" | "active" | "collecting" | "disposed" | "retained";

export interface AgentWorkspace {
	readonly id: string;
	readonly agentSlug: string;
	readonly branch: string;
	readonly baseBranch: string;
	readonly method: "worktree" | "clone";
	readonly state: WorkspaceState;
	readonly path: string;
	readonly pid?: number;
	readonly processName?: string;
	readonly retain: boolean;
	readonly createdAt: string;
	readonly completedAt?: string;
	readonly collectResult: CollectResult | null;
}

const VALID_TRANSITIONS: Record<WorkspaceState, readonly WorkspaceState[]> = {
	provision: ["ready"],
	ready: ["active"],
	active: ["collecting"],
	collecting: ["disposed", "retained"],
	disposed: [],
	retained: ["disposed"],
};

export interface CreateWorkspaceInput {
	readonly agentSlug: string;
	readonly branch: string;
	readonly baseBranch: string;
	readonly method: "worktree" | "clone";
	readonly path: string;
	readonly retain: boolean;
	readonly createdAt: string;
}

interface TransitionMeta {
	readonly pid?: number;
	readonly processName?: string;
	readonly completedAt?: string;
	readonly collectResult?: CollectResult;
}

export function generateWorkspaceId(agentSlug: string, branch: string): string {
	const suffix = branch.split("/").pop() ?? branch;
	const truncated = suffix.slice(0, 20);
	const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
	return `ws-${agentSlug}-${truncated}-${hex}`;
}

export function generateBranchName(agentSlug: string, task: string, prefix: string): string {
	const slug = task
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 8)
		.replace(/-$/, "");
	return `${prefix}${agentSlug}/${slug}`;
}

export function createWorkspace(input: CreateWorkspaceInput): AgentWorkspace {
	return {
		id: generateWorkspaceId(input.agentSlug, input.branch),
		agentSlug: input.agentSlug,
		branch: input.branch,
		baseBranch: input.baseBranch,
		method: input.method,
		state: "provision",
		path: input.path,
		retain: input.retain,
		createdAt: input.createdAt,
		collectResult: null,
	};
}

export function transitionState(ws: AgentWorkspace, to: WorkspaceState, meta?: TransitionMeta): AgentWorkspace {
	const allowed = VALID_TRANSITIONS[ws.state];
	if (!allowed.includes(to)) {
		throw new Error(`Invalid transition: ${ws.state} \u2192 ${to}`);
	}
	return {
		...ws,
		state: to,
		pid: meta?.pid ?? ws.pid,
		processName: meta?.processName ?? ws.processName,
		completedAt: meta?.completedAt ?? ws.completedAt,
		collectResult: meta?.collectResult ?? ws.collectResult,
	};
}

export const COLLECT_SKIPPED_SENTINEL: CollectResult = {
	commits: [],
	filesChanged: 0,
	conversationTurns: 0,
	runtimeState: {},
	errors: ["collectSkipped"],
};
