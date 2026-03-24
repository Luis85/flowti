import type { TrustTier } from "../trust/trust-types.js";
import type { TaskTrustTier } from "./task-types.js";

export type TaskPriorityLane = "urgent" | "high" | "normal";
export type TaskSource = "standing-order" | "bt-action" | "director" | "self-proposed" | "delegated";

export interface TaskEntry {
	readonly taskId: string;
	readonly title: string;
	readonly priority: TaskPriorityLane;
	readonly requiredCapabilities: readonly string[];
	readonly requiredAgentTier: TrustTier;
	readonly taskTrustTier: TaskTrustTier;
	readonly reward: { readonly xp: number; readonly coin: number };
	readonly submittedAt: number;
	readonly source: TaskSource;
	readonly targetAgent?: string;
	readonly retryCount: number;
	readonly tags: readonly string[];
	readonly type: string;
}

export interface TaskHistoryEntry {
	readonly tags: readonly string[];
	readonly type: string;
	readonly assignee: string;
}

export interface AgentScore {
	readonly name: string;
	readonly capable: boolean;
	readonly trustMet: boolean;
	readonly affinityScore: number;
	readonly idle: boolean;
	readonly onCooldown: boolean;
}

export interface DispatcherQueues {
	readonly urgent: TaskEntry[];
	readonly high: TaskEntry[];
	readonly normal: TaskEntry[];
}

export interface DispatcherMetrics {
	readonly queueDepth: { readonly urgent: number; readonly high: number; readonly normal: number };
	readonly activeAssignments: number;
	readonly agentsOnCooldown: number;
	readonly agentsIdle: number;
	readonly tasksCompleted: number;
	readonly tasksFailed: number;
	readonly avgWaitTimeMs: number;
	readonly avgExecutionTimeMs: number;
	readonly agentStats: Record<string, {
		readonly completed: number;
		readonly failed: number;
		readonly avgExecutionTimeMs: number;
		readonly lastTaskAt: number;
	}>;
}
