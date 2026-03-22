/**
 * staging.controller.ts — CLI commands for staging review management.
 *
 * Provides staging:list, staging:review, staging:approve, staging:reject commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { listPendingReviews, readManifest, approveStaged as applyStagedFiles, rejectStaged } from "../domain/tasks/staging.js";
import type { StagingDeps } from "../domain/tasks/staging.js";
import { approveStaged as recordApproval } from "../domain/vault-ops/vault-executor.js";
import { loadTrustProfile, saveTrustProfile } from "../domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../domain/economy/economy-ledger.js";
import { DEFAULT_TRUST_CONFIG } from "../domain/trust/trust-types.js";
import { taskStore } from "../domain/tasks/task-store.js";
import { renderStagingList, renderStagingReview, renderStagingAction } from "../ui/displays/staging-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

// ── Helpers ───────────────────────────────────────────────────────

/** Build a StagingDeps-compatible object from CliDeps. */
function stagingDeps(deps: CliDeps): StagingDeps {
	return {
		disk: deps.disk as unknown as StagingDeps["disk"],
		paths: deps.paths,
	};
}

/** Build a TrustDeps-compatible object from CliDeps. */
function trustDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

/** Build a LedgerDeps-compatible object from CliDeps. */
function ledgerDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

/** Build a TaskStoreDeps-compatible object from CliDeps. */
function taskStoreDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string, enc?: string) => deps.disk.writeFileSync(p, c, (enc ?? "utf-8") as BufferEncoding),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
			readdirSync: (p: string) => deps.disk.readdirSync(p) as string[],
			unlinkSync: (p: string) => deps.disk.unlinkSync(p),
		},
		paths: deps.paths,
	};
}

// ── Commands ─────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"staging:list": adaptDescriptor({
		flags: {
			agent: { type: "string", hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			let manifests = listPendingReviews(sd, VAULT_ROOT);
			const agentFilter = ctx.flags.agent as string | undefined;
			if (agentFilter) {
				manifests = manifests.filter(m => m.agentName === agentFilter);
			}
			return {
				items: manifests.map(m => ({
					taskId: m.taskId,
					agent: m.agentName,
					operation: m.operation,
					fileCount: m.files.length,
					createdAt: m.createdAt,
				})),
			};
		},
		renderer: renderStagingList,
	}),

	"staging:review": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<taskId>" },
		},
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			const taskId = ctx.flags.id as string;
			const manifest = readManifest(sd, VAULT_ROOT, taskId);
			if (!manifest) {
				throw new Error(`Staging area not found: ${taskId}`);
			}
			return {
				taskId: manifest.taskId,
				agent: manifest.agentName,
				operation: manifest.operation,
				files: manifest.files.map(f => ({ path: f.path, action: f.action, previewPath: f.previewPath })),
				createdAt: manifest.createdAt,
			};
		},
		renderer: renderStagingReview,
	}),

	"staging:approve": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<taskId>" },
		},
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			const taskId = ctx.flags.id as string;

			// Read the manifest first to get agent + operation info
			const manifest = readManifest(sd, VAULT_ROOT, taskId);
			if (!manifest) {
				return { taskId, action: "approved" as const, success: false };
			}

			// Copy staged files to their final destinations
			const approvedManifest = applyStagedFiles(sd, VAULT_ROOT, taskId);
			if (!approvedManifest) {
				return { taskId, action: "approved" as const, success: false };
			}

			// Record trust success + economy reward via vault-executor's approveStaged
			const td = trustDeps(ctx.deps);
			const ld = ledgerDeps(ctx.deps);
			const profile = loadTrustProfile(td, VAULT_ROOT, manifest.agentName);
			const ledger = readLedger(ld, VAULT_ROOT);
			const rawDisk = ctx.deps.disk as unknown as Record<string, unknown>;
			const vaultOpsDeps = {
				disk: {
					existsSync: (p: string) => ctx.deps.disk.existsSync(p),
					readFileSync: (p: string, enc: string) => ctx.deps.disk.readFileSync(p, enc as BufferEncoding) as string,
					writeFileSync: (p: string, data: string, enc?: string) => ctx.deps.disk.writeFileSync(p, data, (enc ?? "utf-8") as BufferEncoding),
					mkdirSync: (p: string, opts?: { recursive?: boolean }) => ctx.deps.disk.mkdirSync(p, opts),
					renameSync: (from: string, to: string) => (rawDisk["renameSync"] as (f: string, t: string) => void)(from, to),
					readdirSync: (p: string, opts?: { withFileTypes?: boolean; recursive?: boolean }) =>
						(rawDisk["readdirSync"] as (p: string, o?: Record<string, unknown>) => unknown[])(p, opts),
					statSync: (p: string) => ctx.deps.disk.statSync(p),
					rmSync: (p: string, opts?: { recursive?: boolean; force?: boolean }) => ctx.deps.disk.rmSync(p, opts),
					copyFileSync: (src: string, dest: string) => ctx.deps.disk.copyFileSync(src, dest),
				},
				clock: ctx.deps.clock,
				paths: {
					join: (...segs: string[]) => ctx.deps.paths.join(...segs),
					dirname: (p: string) => ctx.deps.paths.dirname(p),
					basename: (p: string) => ctx.deps.paths.basename(p),
					relative: (from: string, to: string) => ctx.deps.paths.relative(from, to),
				},
				vaultRoot: VAULT_ROOT,
			};
			const { profile: updatedProfile, ledger: updatedLedger } = recordApproval(
				taskId,
				vaultOpsDeps,
				profile,
				DEFAULT_TRUST_CONFIG,
				ledger,
				manifest.operation,
				manifest.agentName,
			);

			// Persist updated profile and ledger
			saveTrustProfile(td, VAULT_ROOT, manifest.agentName, updatedProfile);
			writeLedger(ld, VAULT_ROOT, updatedLedger);

			// Transition task status to completed
			const tsd = taskStoreDeps(ctx.deps);
			taskStore.updateField(tsd, VAULT_ROOT, taskId, "status", "completed");

			return { taskId, action: "approved" as const, success: true };
		},
		renderer: renderStagingAction,
	}),

	"staging:reject": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<taskId>" },
			reason: { type: "string", required: true, hint: "--reason=<text>" },
		},
		handler: (ctx) => {
			const taskId = ctx.flags.id as string;
			const reason = ctx.flags.reason as string;
			const sd = stagingDeps(ctx.deps);
			const result = rejectStaged(sd, VAULT_ROOT, taskId);

			// Transition task status back to pending
			if (result) {
				const tsd = taskStoreDeps(ctx.deps);
				taskStore.updateField(tsd, VAULT_ROOT, taskId, "status", "pending");
			}

			return { taskId, action: "rejected" as const, success: result !== null, reason };
		},
		renderer: renderStagingAction,
	}),
};
