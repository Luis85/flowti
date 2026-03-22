export interface AgentAccount {
	readonly xp: number;
	readonly level: number;
	readonly coin: number;
	readonly tokens: number;
	readonly totalEarned: { readonly xp: number; readonly coin: number };
	readonly totalSpent: { readonly coin: number; readonly tokens: number };
}

export interface EconomyLedger {
	readonly version: number;
	readonly updatedAt: string;
	readonly accounts: Record<string, AgentAccount>;
}

export type TransactionType =
	| "task-reward"
	| "standing-order-reward"
	| "delegation-fee"
	| "delegation-cut"
	| "spend"
	| "llm-spend"
	| "grant"
	| "purchase"
	| "debug";

export interface Transaction {
	readonly ts: string;
	readonly agent: string;
	readonly type: TransactionType;
	readonly taskId?: string;
	readonly item?: string;
	readonly to?: string;
	readonly xp?: number;
	readonly coin?: number;
	readonly tokens?: number;
}

export interface RewardResult {
	readonly xp: number;
	readonly coin: number;
	readonly leveledUp: boolean;
	readonly newLevel?: number;
}

export type EconomyDeps = {
	readonly disk: import("../../infrastructure/types.js").IFileSystem;
	readonly paths: import("../../infrastructure/types.js").IPaths;
	readonly clock: import("../../infrastructure/types.js").IClock;
};
