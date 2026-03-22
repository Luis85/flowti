/** Game-side mirror of CLI WorldState types. */

export type AgentActionType =
	| "thinking" | "speaking" | "asking" | "using-tool" | "tool-complete"
	| "requesting-permission" | "permission-granted" | "permission-denied"
	| "task-started" | "task-completed" | "idle" | "error"
	| "queued"
	| "artifact-dropped" | "file-read" | "file-written" | "file-opened"
	| "goal-started" | "goal-completed" | "template-generated"
	| "seek-rest" | "seek-agent" | "seek-quiet" | "wander-sad"
	| "seek-merchant" | "merchant-purchase";

export interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

export interface WorldEntity {
	readonly id: string;
	readonly type: "agent" | "project" | "iteration" | "artifact";
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

export interface AgentGoal {
	readonly name: string;
	readonly priority?: number;
	readonly condition?: string;
}

export type AgentType = "ai" | "npc" | "human";

export interface DashboardAgent {
	readonly name: string;
	readonly agentType: AgentType;
	readonly domain?: string;
	readonly status: "busy" | "idle" | "unassigned";
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
	readonly skills?: readonly { name: string; level: string }[];
	readonly relationships?: readonly { target: string; type: string }[];
	readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
	readonly goals?: readonly { text: string; priority: string }[];
	readonly behaviors?: readonly string[];
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
	level?: number;
	coin?: number;
	tokens?: number;
	trustTier?: "supervised" | "trusted" | "autonomous";
	capabilities?: string[];
}

export type TaskStatus = "pending" | "in-progress" | "completed" | "failed";

export interface TrackedTask {
	readonly name: string;
	readonly status: TaskStatus;
	readonly assignedAt: number;
	readonly input?: string;
	readonly tool?: { command: string };
}

export interface DashboardData {
	readonly agents: readonly DashboardAgent[];
	readonly projects: readonly { name: string; agents: string[] }[];
}

export type Setting = "office" | "village" | "station" | "hub";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
