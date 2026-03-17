/** Game-side mirror of CLI WorldState types. */

export type AgentActionType =
	| "thinking" | "speaking" | "asking" | "using-tool" | "tool-complete"
	| "requesting-permission" | "permission-granted" | "permission-denied"
	| "task-started" | "task-completed" | "idle" | "error"
	| "queued";

export interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

export interface WorldEntity {
	readonly id: string;
	readonly type: "agent" | "project" | "iteration";
	readonly components: Record<string, unknown>;
}

export interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, WorldEntity>;
	readonly permissions: Record<string, readonly PermissionEntry[]>;
	readonly activityLog: readonly ActivityEntry[];
}

export interface PermissionEntry {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
}

export interface ActivityEntry {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly summary: string;
}

export interface AgentAttributes {
	readonly str?: number;
	readonly int?: number;
	readonly wis?: number;
	readonly cha?: number;
	readonly dex?: number;
	readonly con?: number;
}

export interface DashboardAgent {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly status: "busy" | "idle" | "unassigned";
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
	readonly skills?: readonly { name: string; level: string }[];
	readonly relationships?: readonly { target: string; type: string }[];
	readonly suggestedTasks?: readonly { name: string; phases: string[] }[];
	readonly goals?: readonly { text: string; priority: string }[];
	readonly behaviors?: readonly string[];
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
}

export interface DashboardData {
	readonly agents: readonly DashboardAgent[];
	readonly projects: readonly { name: string; agents: string[] }[];
}

export type Setting = "office" | "village" | "station" | "hub";
