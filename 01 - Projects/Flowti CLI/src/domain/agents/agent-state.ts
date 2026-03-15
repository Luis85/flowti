/** agent-state.ts — Per-agent runtime state persistence (pure domain). */

import type { CliDeps } from "../../infrastructure/deps.js";

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

export interface AgentState {
	readonly name: string;
	readonly status: "idle" | "active" | "busy";
	readonly lastInteraction?: string;
	readonly lastInteractionType?: AgentInteractionType;
	readonly tasks: readonly AgentTask[];
	readonly briefs: readonly AgentBriefRef[];
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
	return { name, status: "idle", tasks: [], briefs: [] };
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
	return { ...state, lastInteraction: timestamp, lastInteractionType: type, status: state.status === "busy" ? "busy" : "active" };
}

/** Add a task to the agent's state. */
export function addTask(state: AgentState, task: AgentTask): AgentState {
	return { ...state, tasks: [...state.tasks, task], status: "busy" };
}

/** Mark a task as done by name. */
export function completeTask(state: AgentState, taskName: string): AgentState {
	const tasks = state.tasks.map((t) => t.name === taskName ? { ...t, status: "done" as const } : t);
	const allDone = tasks.every((t) => t.status === "done");
	return { ...state, tasks, status: allDone ? "idle" : state.status };
}

/** Record a generated brief. */
export function addBrief(state: AgentState, brief: AgentBriefRef): AgentState {
	return { ...state, briefs: [...state.briefs, brief] };
}
