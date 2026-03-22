/**
 * trust.controller.ts — CLI commands for agent trust management.
 *
 * Provides trust:show, trust:promote, trust:demote, and trust:history commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { loadTrustProfile, saveTrustProfile, promote, demote } from "../domain/trust/trust-manager.js";
import type { VaultOperation, TrustLevel } from "../domain/trust/trust-types.js";
import { DEFAULT_OPERATION_TRUST } from "../domain/trust/trust-types.js";
import type { AgentTrustProfile } from "../domain/trust/trust-types.js";
import { renderTrustProfile, renderTrustUpdated, renderTrustHistory, renderTrustReset } from "../ui/displays/trust-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

const VALID_OPS = new Set(Object.keys(DEFAULT_OPERATION_TRUST));
const VALID_LEVELS = new Set<string>(["manual", "review", "auto"]);

function validateOp(op: string): VaultOperation {
	if (!VALID_OPS.has(op)) throw new Error(`Invalid vault operation: ${op}. Valid: ${[...VALID_OPS].join(", ")}`);
	return op as VaultOperation;
}

function validateLevel(level: string): TrustLevel {
	if (!VALID_LEVELS.has(level)) throw new Error(`Invalid trust level: ${level}. Valid: manual, review, auto`);
	return level as TrustLevel;
}

// ── Helpers ───────────────────────────────────────────────────────

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

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"trust:show": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const deps = trustDeps(ctx.deps);
			const profile = loadTrustProfile(deps, VAULT_ROOT, ctx.flags.agent as string);
			return {
				agent: ctx.flags.agent as string,
				tier: profile.tier,
				operations: Object.entries(profile.operations).map(([op, level]) => ({ op, level })),
			};
		},
		renderer: renderTrustProfile,
	}),

	"trust:promote": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			op: { type: "string", required: true, hint: "--op=<operation>" },
			to: { type: "string", required: true, hint: "--to=<level>" },
			reason: { type: "string", default: "manual promotion", hint: "--reason=<text>" },
		},
		handler: (ctx) => {
			const deps = trustDeps(ctx.deps);
			const agentName = ctx.flags.agent as string;
			const profile = loadTrustProfile(deps, VAULT_ROOT, agentName);
			const from = profile.operations[ctx.flags.op as keyof typeof profile.operations] ?? "manual";
			const updated = promote(profile, validateOp(ctx.flags.op as string), validateLevel(ctx.flags.to as string), ctx.flags.reason as string, ctx.deps.clock.iso());
			saveTrustProfile(deps, VAULT_ROOT, agentName, updated);
			return {
				agent: agentName,
				op: ctx.flags.op as string,
				from,
				to: ctx.flags.to as string,
				action: "promote" as const,
			};
		},
		renderer: renderTrustUpdated,
	}),

	"trust:demote": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			op: { type: "string", required: true, hint: "--op=<operation>" },
			to: { type: "string", required: true, hint: "--to=<level>" },
			reason: { type: "string", default: "manual demotion", hint: "--reason=<text>" },
		},
		handler: (ctx) => {
			const deps = trustDeps(ctx.deps);
			const agentName = ctx.flags.agent as string;
			const profile = loadTrustProfile(deps, VAULT_ROOT, agentName);
			const from = profile.operations[ctx.flags.op as keyof typeof profile.operations] ?? "auto";
			const updated = demote(profile, validateOp(ctx.flags.op as string), validateLevel(ctx.flags.to as string), ctx.flags.reason as string, ctx.deps.clock.iso());
			saveTrustProfile(deps, VAULT_ROOT, agentName, updated);
			return {
				agent: agentName,
				op: ctx.flags.op as string,
				from,
				to: ctx.flags.to as string,
				action: "demote" as const,
			};
		},
		renderer: renderTrustUpdated,
	}),

	"trust:reset": adaptDescriptor({
		flags: { agent: { type: "string", required: true, hint: "--agent=<name>" } },
		handler: (ctx) => {
			const td = trustDeps(ctx.deps);
			const agentName = ctx.flags.agent as string;
			const profile = loadTrustProfile(td, VAULT_ROOT, agentName);
			const resetProfile: AgentTrustProfile = {
				tier: "supervised",
				operations: { ...DEFAULT_OPERATION_TRUST },
				promotionLog: profile.promotionLog,
			};
			saveTrustProfile(td, VAULT_ROOT, agentName, resetProfile);
			return {
				agent: agentName,
				operations: resetProfile.operations,
				promotionLog: resetProfile.promotionLog,
			};
		},
		renderer: renderTrustReset,
	}),

	"trust:history": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const deps = trustDeps(ctx.deps);
			const agentName = ctx.flags.agent as string;
			const profile = loadTrustProfile(deps, VAULT_ROOT, agentName);
			return {
				agent: agentName,
				entries: profile.promotionLog.map(e => ({
					op: e.op,
					from: e.from,
					to: e.to,
					at: e.at,
					reason: e.reason,
				})),
			};
		},
		renderer: renderTrustHistory,
	}),
};
