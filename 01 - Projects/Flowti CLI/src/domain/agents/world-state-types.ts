/**
 * world-state-types.ts — ECS-compatible world state types.
 *
 * Defines the unified state model for the agent environment.
 * Entities use string IDs and typed component maps.
 * Agent actions are observable events consumed by any visualization.
 */

export type AgentActionType =
	| "thinking"
	| "speaking"
	| "asking"
	| "using-tool"
	| "tool-complete"
	| "requesting-permission"
	| "permission-granted"
	| "permission-denied"
	| "task-started"
	| "task-completed"
	| "idle"
	| "error"
	| "artifact-dropped"
	| "file-read"
	| "file-written"
	| "file-opened"
	| "goal-started"
	| "goal-completed"
	| "template-generated"
	| "queued"
	| "seek-rest" | "seek-agent" | "seek-quiet" | "wander-sad"
	| "seek-merchant" | "merchant-purchase"
	| "seek-food" | "seek-drink"
	| "seek-preferred-food" | "seek-preferred-drink";

export interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

export type WorldEntityType = "agent" | "project" | "iteration" | "artifact";

export interface WorldEntity {
	readonly id: string;
	readonly type: WorldEntityType;
	readonly components: Record<string, unknown>;
}

export interface PermissionEntry {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly context?: string;
}

export interface ActivityEntry {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly summary: string;
}

export interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, WorldEntity>;
	readonly permissions: Record<string, readonly PermissionEntry[]>;
	readonly activityLog: readonly ActivityEntry[];
}

export interface IWorldStateManager {
	emitAction(action: AgentAction): void;
	updateEntity(id: string, type: WorldEntityType, components: Record<string, unknown>): void;
	getState(): WorldState;
	getEntity(id: string): WorldEntity | null;
	flush(): void;
	addActionListener(callback: (action: AgentAction) => void): void;
	removeActionListener(callback: (action: AgentAction) => void): void;
}
