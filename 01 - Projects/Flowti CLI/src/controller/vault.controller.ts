/**
 * vault.controller.ts — CLI commands for vault operations.
 *
 * Provides vault:exec, vault:context, and task:evaluate commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import type { AnyVaultOpRequest, VaultEvent } from "../domain/vault-ops/vault-ops-types.js";
import type { VaultOperation } from "../domain/trust/trust-types.js";
import { DEFAULT_TRUST_CONFIG } from "../domain/trust/trust-types.js";
import { executeVaultOp } from "../domain/vault-ops/vault-executor.js";
import { buildVaultContext, invalidateContextCache } from "../domain/vault-ops/vault-context.js";
import { evaluateEvent } from "../domain/vault-ops/standing-order-evaluator.js";
import { loadTrustProfile, saveTrustProfile } from "../domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../domain/economy/economy-ledger.js";
import { renderVaultExecResult, renderVaultContext, renderEvaluateResult } from "../ui/displays/vault-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

// ── Constants ────────────────────────────────────────────────────────

const VALID_OPS = new Set<string>([
	"vault-read", "vault-search", "vault-tag",
	"vault-create", "vault-edit", "vault-move", "vault-link",
]);

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a VaultOpsDeps-compatible object from CliDeps. */
function vaultDeps(deps: CliDeps) {
	const rawDisk = deps.disk as unknown as Record<string, unknown>;
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc: string) => deps.disk.readFileSync(p, enc as BufferEncoding) as string,
			writeFileSync: (p: string, data: string, enc?: string) => deps.disk.writeFileSync(p, data, (enc ?? "utf-8") as BufferEncoding),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
			renameSync: (from: string, to: string) => (rawDisk["renameSync"] as (f: string, t: string) => void)(from, to),
			readdirSync: (p: string, opts?: { withFileTypes?: boolean; recursive?: boolean }) =>
				(rawDisk["readdirSync"] as (p: string, o?: Record<string, unknown>) => unknown[])(p, opts),
			statSync: (p: string) => deps.disk.statSync(p),
			rmSync: (p: string, opts?: { recursive?: boolean; force?: boolean }) => deps.disk.rmSync(p, opts),
			copyFileSync: (src: string, dest: string) => deps.disk.copyFileSync(src, dest),
		},
		paths: deps.paths,
		clock: deps.clock,
		vaultRoot: VAULT_ROOT,
	};
}

function validateOp(op: string): VaultOperation {
	if (!VALID_OPS.has(op)) {
		throw new Error(`Invalid vault operation: ${op}. Valid: ${[...VALID_OPS].join(", ")}`);
	}
	return op as VaultOperation;
}

function buildRequest(flags: Record<string, unknown>, op: VaultOperation): AnyVaultOpRequest {
	const agent = flags.agent as string;
	const taskId = flags.task as string | undefined;

	switch (op) {
		case "vault-read":
			return { operation: op, agentName: agent, taskId, path: flags.path as string };
		case "vault-search":
			return {
				operation: op, agentName: agent, taskId,
				query: {
					tags: flags.tags ? (flags.tags as string).split(",").map(t => t.trim()) : undefined,
					folder: flags.folder as string | undefined,
				},
			};
		case "vault-tag":
			return {
				operation: op, agentName: agent, taskId,
				path: flags.path as string,
				addTags: flags["add-tags"] ? (flags["add-tags"] as string).split(",").map(t => t.trim()) : undefined,
				removeTags: flags["remove-tags"] ? (flags["remove-tags"] as string).split(",").map(t => t.trim()) : undefined,
			};
		case "vault-create":
			return {
				operation: op, agentName: agent, taskId,
				path: flags.path as string,
				body: flags.body as string | undefined,
			};
		case "vault-edit":
			return {
				operation: op, agentName: agent, taskId,
				path: flags.path as string,
				content: flags.content as string,
			};
		case "vault-move":
			return {
				operation: op, agentName: agent, taskId,
				fromPath: flags["from-path"] as string,
				toPath: flags["to-path"] as string,
			};
		case "vault-link":
			return {
				operation: op, agentName: agent, taskId,
				path: flags.path as string,
				addLinks: flags["add-links"] ? (flags["add-links"] as string).split(",").map(l => l.trim()) : undefined,
				removeLinks: flags["remove-links"] ? (flags["remove-links"] as string).split(",").map(l => l.trim()) : undefined,
			};
	}
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"vault:exec": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			op: { type: "string", required: true, hint: "--op=<operation>" },
			path: { type: "string", hint: "--path=<path>" },
			"from-path": { type: "string", hint: "--from-path=<path>" },
			"to-path": { type: "string", hint: "--to-path=<path>" },
			"add-tags": { type: "string", hint: "--add-tags=<tag1,tag2>" },
			"remove-tags": { type: "string", hint: "--remove-tags=<tag1,tag2>" },
			content: { type: "string", hint: "--content=<text>" },
			body: { type: "string", hint: "--body=<text>" },
			"add-links": { type: "string", hint: "--add-links=<link1,link2>" },
			"remove-links": { type: "string", hint: "--remove-links=<link1,link2>" },
			folder: { type: "string", hint: "--folder=<path>" },
			tags: { type: "string", hint: "--tags=<tag1,tag2>" },
			task: { type: "string", hint: "--task=<taskId>" },
			"bypass-trust": { type: "boolean", default: false, hint: "--bypass-trust" },
		},
		handler: (ctx) => {
			const operation = validateOp(ctx.flags.op as string);
			const request = buildRequest(ctx.flags, operation);
			const vd = vaultDeps(ctx.deps);
			const ldeps = {
				disk: {
					existsSync: (p: string) => ctx.deps.disk.existsSync(p),
					readFileSync: (p: string, enc?: string) => ctx.deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
					writeFileSync: (p: string, c: string) => ctx.deps.disk.writeFileSync(p, c, "utf-8"),
					mkdirSync: (p: string, opts?: { recursive?: boolean }) => ctx.deps.disk.mkdirSync(p, opts),
				},
				paths: ctx.deps.paths,
				clock: ctx.deps.clock,
			};
			const profile = loadTrustProfile(ldeps, VAULT_ROOT, ctx.flags.agent as string);
			const ledger = readLedger(ldeps, VAULT_ROOT);
			const { result, profile: updatedProfile, ledger: updatedLedger } = executeVaultOp(
				request, vd, profile, DEFAULT_TRUST_CONFIG, ledger,
			);
			saveTrustProfile(ldeps, VAULT_ROOT, ctx.flags.agent as string, updatedProfile);
			writeLedger(ldeps, VAULT_ROOT, updatedLedger);
			return result;
		},
		renderer: renderVaultExecResult,
	}),

	"vault:context": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			rebuild: { type: "boolean", default: false, hint: "--rebuild" },
		},
		handler: (ctx) => {
			const vd = vaultDeps(ctx.deps);
			if (ctx.flags.rebuild) {
				invalidateContextCache(vd);
			}
			return buildVaultContext(vd);
		},
		renderer: renderVaultContext,
	}),

	"task:evaluate": adaptDescriptor({
		flags: {
			event: { type: "string", required: true, hint: "--event=<type>" },
			path: { type: "string", required: true, hint: "--path=<file-path>" },
		},
		handler: (ctx) => {
			const vd = vaultDeps(ctx.deps);
			const eventPath = ctx.flags.path as string;
			const folder = ctx.deps.paths.dirname(eventPath);
			const vaultEvent: VaultEvent = {
				folder,
				type: ctx.flags.event as VaultOperation,
				path: eventPath,
				at: ctx.deps.clock.iso(),
			};
			const requests = evaluateEvent(vaultEvent, [], vd);
			return { matched: requests.length, dispatched: [] };
		},
		renderer: renderEvaluateResult,
	}),
};
