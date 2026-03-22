export type TaskType = "one-off" | "standing-order" | "delegated" | "self-proposed";

export type TaskStatus =
	| "proposed"
	| "pending"
	| "assigned"
	| "in-progress"
	| "review"
	| "completed"
	| "failed";

export type TaskPriority = "normal" | "high" | "urgent";

export type TaskTrustTier = "auto" | "review" | "manual";

export interface TaskReward {
	readonly xp: number;
	readonly coin: number;
}

export interface TaskDefinition {
	readonly id: string;
	readonly type: TaskType;
	readonly title: string;
	readonly assignee?: string;
	readonly creator: string;
	readonly priority: TaskPriority;
	readonly trustTier: TaskTrustTier;
	readonly status: TaskStatus;
	readonly reward: TaskReward;
	readonly tags: readonly string[];
	readonly createdAt: string;
	readonly completedAt?: string;
	readonly journeyId?: string;
}

export interface TaskSummary extends TaskDefinition {
	readonly file: string;
}

export interface StandingOrderPayload {
	readonly watch: { readonly folder: string; readonly event: string };
	readonly rules: readonly StandingOrderRule[];
	readonly schedule: "on-event" | "interval";
	readonly lastRun?: string;
	readonly runCount: number;
}

export interface StandingOrderRule {
	readonly match: Record<string, unknown>;
	readonly action: string;
	readonly value: string;
}

export type StoreDeps = { readonly disk: import("../../infrastructure/types.js").IFileSystem; readonly paths: import("../../infrastructure/types.js").IPaths };
