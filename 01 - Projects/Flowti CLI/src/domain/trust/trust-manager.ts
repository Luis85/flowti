import type { AgentTrustProfile, TrustLevel, VaultOperation, TrustConfig, PromotionLogEntry } from "./trust-types.js";
import { DEFAULT_OPERATION_TRUST, DEFAULT_TRUST_CONFIG } from "./trust-types.js";

type TrustDeps = {
	readonly disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string; writeFileSync(p: string, c: string): void; mkdirSync(p: string, opts?: { recursive?: boolean }): void };
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string };
};

const TRUST_DIR = ".flowti/var/trust";

export function defaultProfile(): AgentTrustProfile {
	return {
		tier: "supervised",
		operations: { ...DEFAULT_OPERATION_TRUST },
		promotionLog: [],
	};
}

export function loadTrustProfile(deps: TrustDeps, vaultRoot: string, agentName: string): AgentTrustProfile {
	const path = deps.paths.join(vaultRoot, TRUST_DIR, `${agentName}.json`);
	if (!deps.disk.existsSync(path)) return defaultProfile();
	const raw = deps.disk.readFileSync(path, "utf-8");
	return JSON.parse(raw) as AgentTrustProfile;
}

export function saveTrustProfile(deps: TrustDeps, vaultRoot: string, agentName: string, profile: AgentTrustProfile): void {
	const dir = deps.paths.join(vaultRoot, TRUST_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const path = deps.paths.join(dir, `${agentName}.json`);
	deps.disk.writeFileSync(path, JSON.stringify(profile, null, "\t"));
}

export function canPerform(profile: AgentTrustProfile, operation: VaultOperation): { allowed: boolean; level: TrustLevel; reason?: string } {
	const level = profile.operations[operation];
	if (level === "auto") return { allowed: true, level };
	if (level === "review") return { allowed: true, level, reason: "requires review after completion" };
	return { allowed: false, level, reason: "requires Director approval" };
}

export function promote(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	newLevel: TrustLevel,
	reason: string,
	iso: string,
): AgentTrustProfile {
	const entry: PromotionLogEntry = {
		op: operation,
		from: profile.operations[operation],
		to: newLevel,
		at: iso,
		reason,
	};
	return {
		...profile,
		operations: { ...profile.operations, [operation]: newLevel },
		promotionLog: [...profile.promotionLog, entry],
		tier: deriveTier({ ...profile, operations: { ...profile.operations, [operation]: newLevel } }),
	};
}

export function demote(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	newLevel: TrustLevel,
	reason: string,
	iso: string,
): AgentTrustProfile {
	const entry: PromotionLogEntry = {
		op: operation,
		from: profile.operations[operation],
		to: newLevel,
		at: iso,
		reason,
	};
	return {
		...profile,
		operations: { ...profile.operations, [operation]: newLevel },
		promotionLog: [...profile.promotionLog, entry],
		tier: deriveTier({ ...profile, operations: { ...profile.operations, [operation]: newLevel } }),
	};
}

export function checkAutoPromotion(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	agentLevel: number,
	successCount: number,
	config: TrustConfig = DEFAULT_TRUST_CONFIG,
): { shouldPromote: boolean; newLevel?: TrustLevel } {
	if (!config.autoPromote) return { shouldPromote: false };
	const threshold = config.thresholds[operation];
	if (!threshold) return { shouldPromote: false };
	if (agentLevel < threshold.minLevel) return { shouldPromote: false };
	if (successCount < threshold.successes) return { shouldPromote: false };

	const currentLevel = profile.operations[operation];
	if (currentLevel === "auto") return { shouldPromote: false };
	const nextLevel: TrustLevel = currentLevel === "manual" ? "review" : "auto";
	return { shouldPromote: true, newLevel: nextLevel };
}

export function deriveTier(profile: AgentTrustProfile): "supervised" | "trusted" | "autonomous" {
	const ops = Object.values(profile.operations);
	const autoCount = ops.filter(l => l === "auto").length;
	const ratio = autoCount / ops.length;
	if (ratio >= 0.8) return "autonomous";
	if (ratio >= 0.5) return "trusted";
	return "supervised";
}
