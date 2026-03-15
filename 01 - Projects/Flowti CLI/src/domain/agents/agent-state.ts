/** agent-state.ts — Per-agent runtime state persistence (pure domain). */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { PermissionGrant } from "./permission-engine.js";
import type { PermissionMode } from "./agent-types.js";

// ── Types ────────────────────────────────────────────────────────────

export type AgentInteractionType = "talk" | "task" | "brief";

export interface AgentTask {
	readonly name: string;
	readonly assignedAt: string;
	readonly status: "pending" | "in-progress" | "done";
	readonly iterationNumber?: number;
}

export interface AgentBriefRef {
	readonly path: string;
	readonly generatedAt: string;
	readonly autonomous: boolean;
}

export interface AgentPendingQuestion {
	readonly question: string;
	readonly briefPath: string;
	readonly task: string;
	readonly iterDir?: string;
	readonly iterationNumber?: number;
}

export interface PendingPermission {
	readonly tool: string;
	readonly requestedAt: string;
	readonly taskContext?: string;
}

export interface AgentState {
	readonly name: string;
	readonly status: "idle" | "active" | "busy" | "waiting";
	readonly lastInteraction?: string;
	readonly lastInteractionType?: AgentInteractionType;
	readonly tasks: readonly AgentTask[];
	readonly briefs: readonly AgentBriefRef[];
	readonly pendingQuestion?: AgentPendingQuestion;
	readonly permissionOverride?: PermissionMode;
	readonly grants: readonly PermissionGrant[];
	readonly pendingPermissions: readonly PendingPermission[];
}

export type AgentStateDeps = Pick<CliDeps, "disk" | "paths">;

// ── File helpers ─────────────────────────────────────────────────────

function toSlug(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stateFileName(agentName: string): string {
	return `data-${toSlug(agentName)}.json`;
}

// ── CRUD ─────────────────────────────────────────────────────────────

function emptyState(name: string): AgentState {
	return { name, status: "idle", tasks: [], briefs: [], grants: [], pendingPermissions: [] };
}

/** Read an agent's persisted state from the var directory. */
export function readAgentState(deps: AgentStateDeps, varDir: string, agentName: string): AgentState {
	const filePath = deps.paths.join(varDir, stateFileName(agentName));
	if (!deps.disk.existsSync(filePath)) return emptyState(agentName);
	try {
		const raw = JSON.parse(deps.disk.readFileSync(filePath, "utf-8")) as Partial<AgentState>;
		return {
			name: raw.name ?? agentName,
			status: raw.status ?? "idle",
			lastInteraction: raw.lastInteraction,
			lastInteractionType: raw.lastInteractionType,
			tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
			briefs: Array.isArray(raw.briefs) ? raw.briefs : [],
			pendingQuestion: (raw as Record<string, unknown>).pendingQuestion as AgentPendingQuestion | undefined,
			grants: Array.isArray((raw as Record<string, unknown>).grants) ? (raw as Record<string, unknown>).grants as PermissionGrant[] : [],
			pendingPermissions: Array.isArray((raw as Record<string, unknown>).pendingPermissions) ? (raw as Record<string, unknown>).pendingPermissions as PendingPermission[] : [],
			permissionOverride: (raw as Record<string, unknown>).permissionOverride as PermissionMode | undefined,
		};
	} catch {
		return emptyState(agentName);
	}
}

/** Write an agent's state to the var directory. */
export function writeAgentState(deps: AgentStateDeps, varDir: string, agentName: string, state: AgentState): void {
	if (!deps.disk.existsSync(varDir)) deps.disk.mkdirSync(varDir, { recursive: true });
	const filePath = deps.paths.join(varDir, stateFileName(agentName));
	deps.disk.writeFileSync(filePath, JSON.stringify(state, null, "\t"), "utf-8");
}

// ── Pure state transitions ───────────────────────────────────────────

/** Record an interaction (talk, task, or brief). Preserves "busy" status if agent is working in background. */
export function recordInteraction(state: AgentState, type: AgentInteractionType, timestamp: string): AgentState {
	return { ...state, lastInteraction: timestamp, lastInteractionType: type, status: (state.status === "busy" || state.status === "waiting") ? state.status : "active" };
}

/** Add a task to the agent's state. */
export function addTask(state: AgentState, task: AgentTask): AgentState {
	return { ...state, tasks: [...state.tasks, task], status: "busy" };
}

/** Mark a task as done by name. */
export function completeTask(state: AgentState, taskName: string): AgentState {
	const tasks = state.tasks.map((t) => t.name === taskName ? { ...t, status: "done" as const } : t);
	const allDone = tasks.every((t) => t.status === "done");
	return { ...state, tasks, status: allDone && state.status !== "waiting" ? "idle" : state.status };
}

/** Mark the first task matching the name (pending or in-progress) as done. Unlike completeTask, this marks only ONE match. */
export function completeFirstTask(state: AgentState, taskName: string): AgentState {
	let found = false;
	const tasks = state.tasks.map((t) => {
		if (!found && t.name === taskName && (t.status === "pending" || t.status === "in-progress")) {
			found = true;
			return { ...t, status: "done" as const };
		}
		return t;
	});
	if (!found) return state;
	const allDone = tasks.every((t) => t.status === "done");
	return { ...state, tasks, status: allDone && state.status !== "waiting" ? "idle" : state.status };
}

/** Remove the first non-done task matching the name. */
export function removeTask(state: AgentState, taskName: string): AgentState {
	const idx = state.tasks.findIndex((t) => t.name === taskName && t.status !== "done");
	if (idx === -1) return state;
	const tasks = [...state.tasks];
	tasks.splice(idx, 1);
	return { ...state, tasks };
}

/** Record a generated brief. */
export function addBrief(state: AgentState, brief: AgentBriefRef): AgentState {
	return { ...state, briefs: [...state.briefs, brief] };
}

/** Remove all once-scoped grants. Returns the same reference if nothing changed. */
export function clearOnceGrants(state: AgentState): AgentState {
	const filtered = state.grants.filter((g) => g.scope !== "once");
	if (filtered.length === state.grants.length) return state;
	return { ...state, grants: filtered };
}
