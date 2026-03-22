/**
 * vault-executor.ts — 5-step vault operation pipeline.
 *
 * validate → trust check → execute/stage → record → reward
 *
 * Pure domain logic: never writes to disk itself — returns updated state.
 */

import type {
	AnyVaultOpRequest,
	VaultOpResult,
	VaultOpsDeps,
	VaultScope,
	VaultMoveRequest,
} from "./vault-ops-types.js";
import type { VaultOperation, AgentTrustProfile, TrustConfig } from "../trust/trust-types.js";
import type { EconomyLedger } from "../economy/economy-types.js";
import type { StagingManifest, StagedFile } from "../tasks/staging.js";
import { canPerform, recordSuccess } from "../trust/trust-manager.js";
import { creditReward } from "../economy/economy-ledger.js";
import { calculateReward } from "../economy/economy-rules.js";
import { createStagingArea } from "../tasks/staging.js";
import {
	vaultRead,
	vaultSearch,
	vaultTag,
	vaultCreate,
	vaultEdit,
	vaultMove,
	vaultLink,
} from "./vault-ops.js";

// ── Constants ────────────────────────────────────────────────────────

const OP_TO_ACTION: Record<string, string> = {
	"vault-create": "create",
	"vault-edit": "modify",
	"vault-tag": "tag",
	"vault-move": "move",
	"vault-link": "link",
	"vault-read": "read",
	"vault-search": "search",
};

const BASE_REWARD = { xp: 50, coin: 25 } as const;

// ── Helpers ──────────────────────────────────────────────────────────

function asStagingDeps(deps: VaultOpsDeps): Parameters<typeof createStagingArea>[0] {
	// VaultOpsDeps.disk methods structurally overlap StagingDeps.disk (Pick<IFileSystem, ...>)
	// but IFileSystem has overloaded signatures that prevent direct assignment.
	const d = deps.disk;
	return {
		disk: d as unknown as Parameters<typeof createStagingArea>[0]["disk"],
		paths: deps.paths,
	};
}

function extractPaths(req: AnyVaultOpRequest): string[] {
	switch (req.operation) {
		case "vault-read":
		case "vault-tag":
		case "vault-create":
		case "vault-edit":
		case "vault-link":
			return [req.path];
		case "vault-move":
			return [(req as VaultMoveRequest).fromPath, (req as VaultMoveRequest).toPath];
		case "vault-search":
			return [];
	}
}

function dispatchOp(req: AnyVaultOpRequest, deps: VaultOpsDeps): unknown {
	switch (req.operation) {
		case "vault-read":
			return vaultRead(req, deps);
		case "vault-search":
			return vaultSearch(req, deps);
		case "vault-tag":
			return vaultTag(req, deps);
		case "vault-create":
			return vaultCreate(req, deps);
		case "vault-edit":
			return vaultEdit(req, deps);
		case "vault-move":
			return vaultMove(req, deps);
		case "vault-link":
			return vaultLink(req, deps);
	}
}

function buildStagedFiles(req: AnyVaultOpRequest, taskId: string): readonly StagedFile[] {
	const action = OP_TO_ACTION[req.operation] as StagedFile["action"];
	const paths = extractPaths(req);
	if (paths.length === 0) return [];
	return paths.map((p) => ({
		path: p,
		action,
		previewPath: `.flowti/var/staging/${taskId}/${p}`,
	}));
}

// ── Exported functions ───────────────────────────────────────────────

export function validateRequest(
	req: AnyVaultOpRequest,
	_deps: VaultOpsDeps,
	scope?: VaultScope,
): { valid: true } | { valid: false; reason: string } {
	const paths = extractPaths(req);

	for (const p of paths) {
		if (!p || p.trim().length === 0) {
			return { valid: false, reason: "Path must not be empty" };
		}
		if (p.includes("..")) {
			return { valid: false, reason: "Path traversal is not allowed" };
		}
	}

	if (scope?.folders && scope.folders.length > 0 && paths.length > 0) {
		for (const p of paths) {
			const allowed = scope.folders.some((folder) => p.startsWith(folder));
			if (!allowed) {
				return { valid: false, reason: `Path "${p}" is outside allowed scope` };
			}
		}
	}

	return { valid: true };
}

export function executeVaultOp(
	req: AnyVaultOpRequest,
	deps: VaultOpsDeps,
	profile: AgentTrustProfile,
	config: TrustConfig,
	ledger: EconomyLedger,
	scope?: VaultScope,
): { result: VaultOpResult; profile: AgentTrustProfile; ledger: EconomyLedger } {
	// Step 1: Validate
	const validation = validateRequest(req, deps, scope);
	if (!validation.valid) {
		return {
			result: {
				outcome: "denied",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				reason: validation.reason,
			},
			profile,
			ledger,
		};
	}

	// Step 2: Trust level check
	const trust = canPerform(profile, req.operation);

	// Step 3a: Manual — queue for Director
	if (trust.level === "manual") {
		return {
			result: {
				outcome: "queued",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
			},
			profile,
			ledger,
		};
	}

	// Step 3b: Review — stage for approval
	if (trust.level === "review") {
		const taskId = req.taskId ?? `staged-${deps.clock.iso()}`;
		try {
			const stagedFiles = buildStagedFiles(req, taskId);
			const manifest: StagingManifest = {
				taskId,
				agentName: req.agentName,
				operation: req.operation,
				files: stagedFiles,
				createdAt: deps.clock.iso(),
				status: "pending",
			};
			createStagingArea(asStagingDeps(deps), deps.vaultRoot, manifest);

			return {
				result: {
					outcome: "staged",
					operation: req.operation,
					agentName: req.agentName,
					taskId,
					stagingId: taskId,
				},
				profile,
				ledger,
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				result: {
					outcome: "failed",
					operation: req.operation,
					agentName: req.agentName,
					taskId: req.taskId,
					reason: message,
				},
				profile,
				ledger,
			};
		}
	}

	// Step 3c: Auto — execute directly
	try {
		const data = dispatchOp(req, deps);

		// Step 4: Record success
		const account = ledger.accounts[req.agentName];
		const agentLevel = account?.level ?? 1;
		const { profile: updatedProfile } = recordSuccess(profile, req.operation, agentLevel, config);

		// Step 5: Reward (only when taskId present)
		let updatedLedger = ledger;
		if (req.taskId) {
			const reward = calculateReward(BASE_REWARD, {
				trustTier: "auto",
				isFirstCompletion: false,
				isStandingOrder: false,
				isDelegation: false,
			});
			const credited = creditReward(ledger, req.agentName, reward);
			updatedLedger = credited.ledger;
		}

		return {
			result: {
				outcome: "executed",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				data,
			},
			profile: updatedProfile,
			ledger: updatedLedger,
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			result: {
				outcome: "failed",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				reason: message,
			},
			profile,
			ledger,
		};
	}
}

export function approveStaged(
	_taskId: string,
	_deps: VaultOpsDeps,
	profile: AgentTrustProfile,
	config: TrustConfig,
	ledger: EconomyLedger,
	operation: VaultOperation,
	agentName: string,
): { profile: AgentTrustProfile; ledger: EconomyLedger } {
	const account = ledger.accounts[agentName];
	const agentLevel = account?.level ?? 1;
	const { profile: updatedProfile } = recordSuccess(profile, operation, agentLevel, config);

	const reward = calculateReward(BASE_REWARD, {
		trustTier: "review",
		isFirstCompletion: false,
		isStandingOrder: false,
		isDelegation: false,
	});
	const { ledger: updatedLedger } = creditReward(ledger, agentName, reward);

	return { profile: updatedProfile, ledger: updatedLedger };
}
