/**
 * economy.controller.ts — CLI commands for agent economy management.
 *
 * Provides economy:balance, economy:ledger, and economy:grant commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { readLedger, writeLedger, getAccount, grantResources, appendTransaction } from "../domain/economy/economy-ledger.js";
import { titleForLevel } from "../domain/economy/leveling.js";
import { renderBalance, renderLedger, renderGrant } from "../ui/displays/economy-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

// ── Helpers ───────────────────────────────────────────────────────

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

// ── Commands ─────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"economy:balance": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const ledger = readLedger(ledgerDeps(ctx.deps), VAULT_ROOT);
			const account = getAccount(ledger, ctx.flags.agent as string);
			return {
				agent: ctx.flags.agent as string,
				xp: account.xp,
				level: account.level,
				title: titleForLevel(account.level),
				coin: account.coin,
				tokens: account.tokens,
			};
		},
		renderer: renderBalance,
	}),

	"economy:ledger": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			limit: { type: "number", default: 20, hint: "--limit=<n>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const limit = ctx.flags.limit as number;
			const logPath = ctx.deps.paths.join(VAULT_ROOT, ".flowti/var/economy-log.jsonl");
			const raw = ctx.deps.disk.existsSync(logPath)
				? (ctx.deps.disk.readFileSync(logPath, "utf-8") as string)
				: "";
			const lines = raw.split("\n").filter(l => l.trim() !== "");
			const all = lines
				.map(l => {
					try { return JSON.parse(l) as { ts: string; agent: string; type: string; xp?: number; coin?: number; tokens?: number }; }
					catch { return null; }
				})
				.filter((e): e is { ts: string; agent: string; type: string; xp?: number; coin?: number; tokens?: number } => e !== null && e.agent === agent);
			const entries = all.slice(-limit);
			return { agent, entries };
		},
		renderer: renderLedger,
	}),

	"economy:grant": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			coin: { type: "number", default: 0, hint: "--coin=<amount>" },
			tokens: { type: "number", default: 0, hint: "--tokens=<amount>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const coin = ctx.flags.coin as number;
			const tokens = ctx.flags.tokens as number;
			const deps = ledgerDeps(ctx.deps);
			const ledger = readLedger(deps, VAULT_ROOT);
			const updated = grantResources(ledger, agent, { coin, tokens });
			writeLedger(deps, VAULT_ROOT, updated);
			appendTransaction(deps, VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent,
				type: "grant",
				coin,
				tokens,
			});
			return { agent, coin, tokens };
		},
		renderer: renderGrant,
	}),
};
