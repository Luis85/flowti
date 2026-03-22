/**
 * economy.controller.ts — CLI commands for agent economy management.
 *
 * Provides economy:balance, economy:ledger, economy:grant, and economy:reward commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { readLedger, writeLedger, getAccount, creditReward, grantResources, appendTransaction } from "../domain/economy/economy-ledger.js";
import { calculateReward } from "../domain/economy/economy-rules.js";
import { titleForLevel } from "../domain/economy/leveling.js";
import { taskStore } from "../domain/tasks/task-store.js";
import type { TaskTrustTier } from "../domain/tasks/task-types.js";
import { loadTrustProfile, saveTrustProfile, checkAutoPromotion, promote } from "../domain/trust/trust-manager.js";
import type { VaultOperation } from "../domain/trust/trust-types.js";
import { renderBalance, renderLedger, renderGrant, renderReward } from "../ui/displays/economy-display.js";
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

/** Build a TaskStoreDeps-compatible object from CliDeps. */
function taskDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
			readdirSync: (p: string) => deps.disk.readdirSync(p) as string[],
			unlinkSync: (p: string) => deps.disk.unlinkSync(p),
		},
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

	"economy:reward": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			task: { type: "string", default: "", hint: "--task=<id>" },
			xp: { type: "number", default: 50, hint: "--xp=<amount>" },
			coin: { type: "number", default: 25, hint: "--coin=<amount>" },
			"trust-tier": { type: "string", default: "review", hint: "--trust-tier=<tier>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const taskId = ctx.flags.task as string;
			const ld = ledgerDeps(ctx.deps);

			// Read task from store if available
			const task = taskId ? taskStore.read(taskDeps(ctx.deps), VAULT_ROOT, taskId) : undefined;
			const baseReward = task
				? task.reward
				: { xp: ctx.flags.xp as number, coin: ctx.flags.coin as number };
			const trustTier = (task?.trustTier ?? ctx.flags["trust-tier"]) as TaskTrustTier;

			// Calculate reward with multipliers
			const reward = calculateReward(baseReward, {
				trustTier,
				isFirstCompletion: false,
				isStandingOrder: task?.type === "standing-order",
				isDelegation: task?.type === "delegated",
			});

			// Credit to ledger
			let ledger = readLedger(ld, VAULT_ROOT);
			const result = creditReward(ledger, agent, reward);
			ledger = result.ledger;
			writeLedger(ld, VAULT_ROOT, ledger);

			// Log transaction
			appendTransaction(ld, VAULT_ROOT, {
				ts: ctx.deps.clock.iso(), agent, type: "task-reward",
				taskId: taskId || undefined, xp: reward.xp, coin: reward.coin,
			});

			// Check auto-promotion
			let trustPromoted: { agentName: string; op: string; from: string; to: string } | undefined;
			if (task) {
				const profile = loadTrustProfile(trustDeps(ctx.deps), VAULT_ROOT, agent);
				const successCount = taskStore.countCompletedByAgent(taskDeps(ctx.deps), VAULT_ROOT, agent);
				const account = getAccount(ledger, agent);
				// Check each vault operation for auto-promotion
				for (const op of Object.keys(profile.operations) as VaultOperation[]) {
					const check = checkAutoPromotion(profile, op, account.level, successCount);
					if (check.shouldPromote && check.newLevel) {
						const promoted = promote(profile, op, check.newLevel, "auto-promotion after task reward", ctx.deps.clock.iso());
						saveTrustProfile(trustDeps(ctx.deps), VAULT_ROOT, agent, promoted);
						trustPromoted = { agentName: agent, op, from: profile.operations[op], to: check.newLevel };
						break; // One promotion per reward
					}
				}
			}

			const account = getAccount(ledger, agent);
			return {
				agent,
				xp: reward.xp,
				coin: reward.coin,
				totalXp: account.xp,
				totalCoin: account.coin,
				level: account.level,
				leveledUp: result.reward.leveledUp,
				newLevel: result.reward.newLevel,
				newTitle: result.reward.leveledUp ? titleForLevel(result.reward.newLevel!) : undefined,
				trustPromoted,
			};
		},
		renderer: renderReward,
	}),
};
