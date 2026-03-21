export type TrustLevel = "manual" | "review" | "auto";

export type VaultOperation =
	| "vault-read" | "vault-search" | "vault-tag"
	| "vault-create" | "vault-edit" | "vault-move" | "vault-link";

export interface PromotionLogEntry {
	readonly op: VaultOperation;
	readonly from: TrustLevel;
	readonly to: TrustLevel;
	readonly at: string;
	readonly reason: string;
}

export interface AgentTrustProfile {
	readonly tier: "supervised" | "trusted" | "autonomous";
	readonly operations: Record<VaultOperation, TrustLevel>;
	readonly promotionLog: readonly PromotionLogEntry[];
	readonly successCounts: Partial<Record<VaultOperation, number>>;
}

export interface TrustThreshold {
	readonly successes: number;
	readonly minLevel: number;
}

export interface TrustConfig {
	readonly autoPromote: boolean;
	readonly thresholds: Partial<Record<VaultOperation, TrustThreshold>>;
}

export const DEFAULT_OPERATION_TRUST: Record<VaultOperation, TrustLevel> = {
	"vault-read": "auto",
	"vault-search": "auto",
	"vault-tag": "review",
	"vault-create": "review",
	"vault-edit": "manual",
	"vault-move": "manual",
	"vault-link": "review",
};

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
	autoPromote: true,
	thresholds: {
		"vault-tag": { successes: 20, minLevel: 2 },
		"vault-create": { successes: 50, minLevel: 4 },
		"vault-edit": { successes: 100, minLevel: 5 },
	},
};
