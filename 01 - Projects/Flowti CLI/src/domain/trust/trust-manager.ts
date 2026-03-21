import type { AgentTrustProfile, TrustLevel, TrustConfig, VaultOperation, PromotionLogEntry } from "./trust-types.js";
import { DEFAULT_OPERATION_TRUST } from "./trust-types.js";

const TRUST_PATH_PREFIX = ".flowti/var/trust-";

type TrustDeps = {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc?: string): string;
		writeFileSync(p: string, c: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
	};
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string };
	readonly clock?: { iso(): string };
};

export function loadTrustProfile(deps: TrustDeps, vaultRoot: string, agentName: string): AgentTrustProfile {
	const path = deps.paths.join(vaultRoot, `${TRUST_PATH_PREFIX}${agentName}.json`);
	if (!deps.disk.existsSync(path)) {
		return buildDefaultProfile();
	}
	const raw = deps.disk.readFileSync(path, "utf-8");
	return JSON.parse(raw) as AgentTrustProfile;
}

export function saveTrustProfile(deps: TrustDeps, vaultRoot: string, agentName: string, profile: AgentTrustProfile): void {
	const path = deps.paths.join(vaultRoot, `${TRUST_PATH_PREFIX}${agentName}.json`);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(path, JSON.stringify(profile, null, "\t"));
}

export function canPerform(
	profile: AgentTrustProfile,
	operation: VaultOperation,
): { allowed: boolean; level: TrustLevel; reason?: string } {
	const level = profile.operations[operation];
	if (level === "auto") return { allowed: true, level };
	if (level === "review") return { allowed: true, level };
	return { allowed: false, level, reason: "requires Director" };
}

export function promote(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	level: TrustLevel,
	reason: string,
	clock?: { iso(): string },
): AgentTrustProfile {
	const from = profile.operations[operation];
	const entry: PromotionLogEntry = {
		op: operation,
		from,
		to: level,
		at: clock?.iso() ?? new Date().toISOString(),
		reason,
	};
	const updatedProfile: AgentTrustProfile = {
		...profile,
		operations: { ...profile.operations, [operation]: level },
		promotionLog: [...profile.promotionLog, entry],
	};
	return { ...updatedProfile, tier: deriveTier(updatedProfile) };
}

export function demote(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	level: TrustLevel,
	reason: string,
	clock?: { iso(): string },
): AgentTrustProfile {
	const from = profile.operations[operation];
	const entry: PromotionLogEntry = {
		op: operation,
		from,
		to: level,
		at: clock?.iso() ?? new Date().toISOString(),
		reason,
	};
	const updatedProfile: AgentTrustProfile = {
		...profile,
		operations: { ...profile.operations, [operation]: level },
		promotionLog: [...profile.promotionLog, entry],
	};
	return { ...updatedProfile, tier: deriveTier(updatedProfile) };
}

export function recordSuccess(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	currentCount: number,
): { profile: AgentTrustProfile; promoted: boolean } {
	return { profile, promoted: false };
}

export function checkAutoPromotion(
	profile: AgentTrustProfile,
	operation: VaultOperation,
	agentLevel: number,
	config: TrustConfig,
	successCount: number,
): boolean {
	if (!config.autoPromote) return false;
	const threshold = config.thresholds[operation];
	if (!threshold) return false;
	return successCount >= threshold.successes && agentLevel >= threshold.minLevel;
}

export function deriveTier(profile: AgentTrustProfile): "supervised" | "trusted" | "autonomous" {
	const ops = Object.values(profile.operations) as TrustLevel[];
	const total = ops.length;
	if (total === 0) return "supervised";
	const autoCount = ops.filter(l => l === "auto").length;
	const ratio = autoCount / total;
	if (ratio >= 0.8) return "autonomous";
	if (ratio >= 0.5) return "trusted";
	return "supervised";
}

function buildDefaultProfile(): AgentTrustProfile {
	const profile: Omit<AgentTrustProfile, "tier"> & { tier: "supervised" | "trusted" | "autonomous" } = {
		tier: "supervised",
		operations: { ...DEFAULT_OPERATION_TRUST },
		promotionLog: [],
	};
	return { ...profile, tier: deriveTier(profile) };
}
